import { expect, test } from 'vitest'

import { apiErrorSchema, healthResponseSchema, isKnownErrorCode } from './index'

test('health response requires aiConfigured', () => {
  expect(healthResponseSchema.safeParse({ status: 'ok', aiConfigured: true }).success).toBe(true)
  expect(healthResponseSchema.safeParse({ status: 'ok' }).success).toBe(false)
})

test('error envelope accepts an unknown code but requires retryable', () => {
  const unknownCode = { error: { code: 'ai_rate_limited', message: 'Slow down', retryable: true } }
  expect(apiErrorSchema.safeParse(unknownCode).success).toBe(true)

  const missingRetryable = { error: { code: 'ai_failed', message: 'Failed' } }
  expect(apiErrorSchema.safeParse(missingRetryable).success).toBe(false)
})

test('isKnownErrorCode recognises only the codes in ERROR_CODES', () => {
  expect(isKnownErrorCode('ai_failed')).toBe(true)
  expect(isKnownErrorCode('ai_rate_limited')).toBe(false)
})
