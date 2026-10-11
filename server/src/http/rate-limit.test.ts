import type { Request, Response } from 'express'
import { describe, expect, test } from 'vitest'

import { AppError } from './errors'
import { createRateLimiter } from './rate-limit'

type Limiter = ReturnType<typeof createRateLimiter>

interface Outcome {
  allowed: boolean
  retryAfter: string | undefined
  error: unknown
}

// Calls the middleware directly with a fake request from `ip`, so a test can play several
// clients and a clock without opening sockets or sleeping.
function hit(limiter: Limiter, ip: string): Outcome {
  let retryAfter: string | undefined
  let allowed = false
  let error: unknown
  const res = {
    setHeader: (name: string, value: string) => {
      if (name.toLowerCase() === 'retry-after') retryAfter = value
      return res
    },
  } as unknown as Response
  try {
    limiter({ ip } as Request, res, () => {
      allowed = true
    })
  } catch (caught) {
    error = caught
  }
  return { allowed, retryAfter, error }
}

function clock(start = 1_000_000) {
  let current = start
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms
    },
  }
}

describe('createRateLimiter', () => {
  test('lets max requests through, then refuses with 429 too_many_requests and Retry-After', () => {
    const time = clock()
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3, now: time.now })

    const first = [hit(limiter, 'a'), hit(limiter, 'a'), hit(limiter, 'a')]
    time.advance(10_500)
    const fourth = hit(limiter, 'a')

    expect(first.every((outcome) => outcome.allowed)).toBe(true)
    expect(fourth.allowed).toBe(false)
    expect(fourth.error).toBeInstanceOf(AppError)
    expect(fourth.error).toMatchObject({ code: 'too_many_requests', status: 429 })
    // 49.5 seconds are left in the window, rounded up to whole seconds.
    expect(fourth.retryAfter).toBe('50')
  })

  test('allows the same client again once the window has ended', () => {
    const time = clock()
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3, now: time.now })
    for (let i = 0; i < 3; i += 1) hit(limiter, 'a')
    expect(hit(limiter, 'a').allowed).toBe(false)

    time.advance(59_999)
    expect(hit(limiter, 'a').allowed).toBe(false)
    time.advance(1)

    expect(hit(limiter, 'a').allowed).toBe(true)
    expect(hit(limiter, 'a').allowed).toBe(true)
    expect(hit(limiter, 'a').allowed).toBe(true)
    expect(hit(limiter, 'a').allowed).toBe(false)
  })

  test('counts two clients separately', () => {
    const time = clock()
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, now: time.now })
    hit(limiter, 'a')
    hit(limiter, 'a')

    expect(hit(limiter, 'a').allowed).toBe(false)
    expect(hit(limiter, 'b').allowed).toBe(true)
    expect(hit(limiter, 'b').allowed).toBe(true)
    expect(hit(limiter, 'b').allowed).toBe(false)
  })

  test('removes entries whose window has ended once more than 1000 clients are tracked', () => {
    const time = clock()
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3, now: time.now })
    for (let i = 0; i < 1000; i += 1) hit(limiter, `old-${String(i)}`)
    expect(limiter.trackedClients()).toBe(1000)

    time.advance(60_000)
    hit(limiter, 'new-1')

    // The 1001st client pushes the map past 1000, which sweeps the ended windows.
    expect(limiter.trackedClients()).toBe(1)
  })

  test('keeps entries whose window is still running when it sweeps', () => {
    const time = clock()
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, now: time.now })
    for (let i = 0; i < 1001; i += 1) hit(limiter, `live-${String(i)}`)

    expect(limiter.trackedClients()).toBe(1001)
    expect(hit(limiter, 'live-0').allowed).toBe(false)
  })

  test('uses the documented defaults of 20 requests per 60 seconds', () => {
    const time = clock()
    const limiter = createRateLimiter({ now: time.now })

    const outcomes = Array.from({ length: 21 }, () => hit(limiter, 'a'))

    expect(outcomes.slice(0, 20).every((outcome) => outcome.allowed)).toBe(true)
    expect(outcomes[20]?.allowed).toBe(false)
    time.advance(60_000)
    expect(hit(limiter, 'a').allowed).toBe(true)
  })
})
