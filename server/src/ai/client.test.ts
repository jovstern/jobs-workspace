import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { z } from 'zod'

import { startFakeGemini } from '../test-support/fake-gemini'
import type { FakeGemini } from '../test-support/fake-gemini'
import { createGeminiClient } from './client'
import type { GenerateJsonRequest } from './client'
import type { AiFailureDiagnostic } from './diagnose'

let fake: FakeGemini

beforeAll(async () => {
  fake = await startFakeGemini()
})

afterAll(async () => {
  await fake.close()
})

beforeEach(() => {
  fake.reset()
})

// The stand-in answers 400 to any prompt it does not recognise, which is a convenient real
// INVALID_ARGUMENT from the SDK's point of view.
async function callWith(onFailure: (d: AiFailureDiagnostic) => void) {
  const ai = createGeminiClient({ apiKey: 'test-key', baseUrl: fake.url })
  const request: GenerateJsonRequest<unknown> = {
    task: 'fit',
    system: 'system text',
    userText: 'Hello from a test that the stand-in does not recognise.',
    schema: z.object({ ratings: z.array(z.unknown()) }),
    signal: new AbortController().signal,
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
    expect(seen).toEqual([{ httpStatus: 400, category: 'INVALID_ARGUMENT' }])
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error).toMatchObject({ name: 'AppError', code: 'ai_failed' })
    const text = JSON.stringify(outcome.error) + (outcome.error as Error).message
    expect(text).not.toContain('Unrecognised prompt')
    expect(text).not.toContain('INVALID_ARGUMENT')
  })

  test.each([
    ['http_429', { httpStatus: 429, category: 'RESOURCE_EXHAUSTED' }],
    ['http_503', { httpStatus: 503, category: 'UNAVAILABLE' }],
    ['blocked', { httpStatus: null, category: 'blocked' }],
    ['truncated', { httpStatus: null, category: 'unfinished' }],
    ['garbage', { httpStatus: null, category: 'invalid_json' }],
  ] as const)('the %s scenario reports %j', async (scenario, expected) => {
    fake.setScenario(scenario)
    const seen: AiFailureDiagnostic[] = []
    await callWith((d) => seen.push(d))
    expect(seen).toEqual([expected])
  })

  test('the diagnostic never holds the provider message', async () => {
    fake.setScenario('http_429')
    const seen: AiFailureDiagnostic[] = []
    await callWith((d) => seen.push(d))
    expect(JSON.stringify(seen)).not.toContain('Quota exceeded')
  })
})
