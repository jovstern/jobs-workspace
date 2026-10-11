import type { RequestHandler } from 'express'

import { AppError } from './errors'

export interface RateLimiterOptions {
  windowMs?: number
  max?: number
  now: () => number
}

export type RateLimiter = RequestHandler & { trackedClients: () => number }

interface Window {
  startedAt: number
  count: number
}

// Past this many tracked clients, windows that have ended are swept out.
const SWEEP_THRESHOLD = 1000

// A small fixed-window limiter for the paid routes (D-19: hand-written, no dependency). State is
// an address, a count and a window start per client; it never holds anything from a request body.
// It lives in this closure, so each app has its own counts.
export function createRateLimiter({
  windowMs = 60_000,
  max = 20,
  now,
}: RateLimiterOptions): RateLimiter {
  const windows = new Map<string, Window>()

  const handler: RequestHandler = (req, res, next) => {
    const time = now()
    const client = req.ip ?? 'unknown'

    let current = windows.get(client)
    if (current === undefined || time >= current.startedAt + windowMs) {
      current = { startedAt: time, count: 0 }
      windows.set(client, current)
      if (windows.size > SWEEP_THRESHOLD) {
        for (const [key, other] of windows) {
          if (time >= other.startedAt + windowMs) windows.delete(key)
        }
      }
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.ceil((current.startedAt + windowMs - time) / 1000)
      res.setHeader('Retry-After', String(retryAfterSeconds))
      throw new AppError('too_many_requests')
    }

    current.count += 1
    next()
  }

  return Object.assign(handler, { trackedClients: () => windows.size })
}
