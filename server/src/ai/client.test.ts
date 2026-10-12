import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { z } from 'zod'

import { startFakeGemini } from '../test-support/fake-gemini'
import type { FakeGemini } from '../test-support/fake-gemini'
import { createGeminiClient } from './client'
import type { GenerateJsonRequest } from './client'
import type { AiFailureDiagnostic } from './diagnose'

let fake: FakeGemini
// Answers slowly, but not for long: a deadline of a tenth of a second passes well before it does.
let slowFake: FakeGemini

beforeAll(async () => {
  fake = await startFakeGemini()
  slowFake = await startFakeGemini({ slowDelayMs: 1000 })
})

afterAll(async () => {
  await fake.close()
  await slowFake.close()
})

beforeEach(() => {
  fake.reset()
  slowFake.reset()
})

// The stand-in answers 400 to any prompt it does not recognise, which is a convenient real
// INVALID_ARGUMENT from the SDK's point of view.
async function callWith(
  onFailure: (d: AiFailureDiagnostic) => void,
  extra: { url?: string; signal?: AbortSignal; deadlineMs?: number } = {},
) {
  const ai = createGeminiClient({ apiKey: 'test-key', baseUrl: extra.url ?? fake.url })
  const request: GenerateJsonRequest<unknown> = {
    task: 'fit',
    system: 'system text',
    userText: 'Hello from a test that the stand-in does not recognise.',
    schema: z.object({ ratings: z.array(z.unknown()).min(1) }),
    signal: extra.signal ?? new AbortController().signal,
    overrides: extra.deadlineMs === undefined ? undefined : { deadlineMs: extra.deadlineMs },
    onFailure,
  }
  return ai.generateJson(request).then(
    () => ({ ok: true as const }),
    (error: unknown) => ({ ok: false as const, error }),
  )
}

describe('failure diagnostics', () => {
  test('a provider HTTP error reports its status and category and still throws the typed error', async () => {
    const seen: AiFailureDiagnostic[] = []
    const outcome = await callWith((d) => seen.push(d))
    expect(seen).toMatchObject([
      { httpStatus: 400, category: 'INVALID_ARGUMENT', errorClass: 'ApiError' },
    ])
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error).toMatchObject({ name: 'AppError', code: 'ai_failed' })
    const text = JSON.stringify(outcome.error) + (outcome.error as Error).message
    expect(text).not.toContain('Unrecognised prompt')
    expect(text).not.toContain('INVALID_ARGUMENT')
  })

  test.each([
    ['http_429', { httpStatus: 429, category: 'RESOURCE_EXHAUSTED' }, 'ai_rate_limited'],
    ['http_503', { httpStatus: 503, category: 'UNAVAILABLE' }, 'ai_overloaded'],
    ['blocked', { httpStatus: null, category: 'blocked' }, 'ai_blocked'],
    ['truncated', { httpStatus: null, category: 'unfinished' }, 'ai_truncated'],
    ['garbage', { httpStatus: null, category: 'invalid_json' }, 'ai_invalid_output'],
    ['finish_safety', { httpStatus: null, category: 'blocked' }, 'ai_blocked'],
    ['finish_unexpected', { httpStatus: null, category: 'unknown' }, 'ai_failed'],
    ['empty', { httpStatus: null, category: 'empty_text' }, 'ai_invalid_output'],
    ['no_candidate', { httpStatus: null, category: 'empty_text' }, 'ai_invalid_output'],
    ['empty_ratings', { httpStatus: null, category: 'schema_mismatch' }, 'ai_invalid_output'],
  ] as const)('the %s scenario reports %j and throws %s', async (scenario, expected, code) => {
    fake.setScenario(scenario)
    const seen: AiFailureDiagnostic[] = []
    const outcome = await callWith((d) => seen.push(d))
    expect(seen).toMatchObject([expected])
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error).toMatchObject({ name: 'AppError', code })
  })

  test('the diagnostic never holds the provider message', async () => {
    fake.setScenario('http_429')
    const seen: AiFailureDiagnostic[] = []
    await callWith((d) => seen.push(d))
    expect(JSON.stringify(seen)).not.toContain('Quota exceeded')
  })
})

describe('a missed deadline and a caller that left', () => {
  test('a deadline that passes while the provider is slow is ai_timeout, reported as a timeout', async () => {
    slowFake.setScenario('slow')
    const seen: AiFailureDiagnostic[] = []

    const outcome = await callWith((d) => seen.push(d), { url: slowFake.url, deadlineMs: 100 })

    expect(seen).toEqual([{ httpStatus: null, category: 'timeout', errorClass: 'TimeoutError' }])
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error).toMatchObject({ name: 'AppError', code: 'ai_timeout' })
    expect(slowFake.requestCount()).toBe(1)
  })

  test('a caller that goes away while the provider is slow is ai_failed, never ai_timeout', async () => {
    slowFake.setScenario('slow')
    const caller = new AbortController()
    setTimeout(() => {
      caller.abort()
    }, 20)
    const seen: AiFailureDiagnostic[] = []

    const outcome = await callWith((d) => seen.push(d), {
      url: slowFake.url,
      signal: caller.signal,
      deadlineMs: 5000,
    })

    expect(seen).toMatchObject([{ httpStatus: null, category: 'aborted' }])
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error).toMatchObject({ name: 'AppError', code: 'ai_failed' })
  })

  test('a caller that left first is still ai_failed when the deadline has passed too', async () => {
    slowFake.setScenario('slow')
    const caller = new AbortController()
    // The caller is gone before the call starts and the deadline is one millisecond: whichever of
    // the two has fired when the failure is read, the caller left first, so it is not a timeout.
    caller.abort()
    const seen: AiFailureDiagnostic[] = []

    const outcome = await callWith((d) => seen.push(d), {
      url: slowFake.url,
      signal: caller.signal,
      deadlineMs: 1,
    })

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error).toMatchObject({ name: 'AppError', code: 'ai_failed' })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.category).not.toBe('timeout')
  })
})
