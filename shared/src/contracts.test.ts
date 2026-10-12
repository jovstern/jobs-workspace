import { expect, test } from 'vitest'

import {
  apiErrorSchema,
  ERROR_CODES,
  ERROR_MESSAGES,
  GENERIC_NOT_RETRYABLE_MESSAGE,
  GENERIC_RETRYABLE_MESSAGE,
  healthResponseSchema,
  isKnownErrorCode,
} from './index'

test('health response requires aiConfigured', () => {
  expect(healthResponseSchema.safeParse({ status: 'ok', aiConfigured: true }).success).toBe(true)
  expect(healthResponseSchema.safeParse({ status: 'ok' }).success).toBe(false)
})

test('error envelope accepts an unknown code but requires retryable', () => {
  const unknownCode = {
    error: { code: 'some_future_code', message: 'Slow down', retryable: true },
  }
  expect(apiErrorSchema.safeParse(unknownCode).success).toBe(true)

  const missingRetryable = { error: { code: 'ai_failed', message: 'Failed' } }
  expect(apiErrorSchema.safeParse(missingRetryable).success).toBe(false)
})

test('isKnownErrorCode recognises only the codes in ERROR_CODES', () => {
  expect(isKnownErrorCode('ai_failed')).toBe(true)
  expect(isKnownErrorCode('ai_rate_limited')).toBe(true)
  expect(isKnownErrorCode('some_future_code')).toBe(false)
})

test('there are eighteen error codes', () => {
  expect(ERROR_CODES).toHaveLength(18)
})

test('every error code has a non-empty sentence', () => {
  for (const code of ERROR_CODES) {
    expect(ERROR_MESSAGES[code].length, code).toBeGreaterThan(0)
  }
})

test('the sentences the user reads are pinned', () => {
  expect(ERROR_MESSAGES.ai_rate_limited).toBe(
    "Google's AI is rate limiting this key. Wait a while, then try again. If it keeps happening, a daily quota may be used up: check your usage in Google AI Studio.",
  )
  expect(ERROR_MESSAGES.ai_blocked).toBe(
    'The AI declined to process this resume and job, so no fit check was saved. Trying the same check again is unlikely to help.',
  )
  expect(ERROR_MESSAGES.too_many_requests).toBe(
    'Too many requests in a short time. Wait a minute, then try again.',
  )
  expect(ERROR_MESSAGES.forbidden_origin).toBe(
    "The app server refused this page's address. Open the app at http://localhost:5173 or set ALLOWED_ORIGINS.",
  )
  expect(ERROR_MESSAGES.validation_error).toBe(
    'Something went wrong on our side. Reload the page and check again.',
  )
})

test('the two generic sentences are the ones the request errors and the retryable errors share', () => {
  expect(GENERIC_RETRYABLE_MESSAGE).toBe('Something went wrong on our side. Try again.')
  expect(GENERIC_NOT_RETRYABLE_MESSAGE).toBe(
    'Something went wrong on our side. Reload the page and check again.',
  )
  expect(ERROR_MESSAGES.ai_failed).toBe(GENERIC_RETRYABLE_MESSAGE)
  expect(ERROR_MESSAGES.internal_error).toBe(GENERIC_RETRYABLE_MESSAGE)
  for (const code of [
    'validation_error',
    'not_found',
    'unsupported_media_type',
    'payload_too_large',
  ] as const) {
    expect(ERROR_MESSAGES[code], code).toBe(GENERIC_NOT_RETRYABLE_MESSAGE)
  }
})
