import { expect, test } from 'vitest'

import { ApiError } from '../../lib/api'
import { describeFitError } from './fit-errors'

const GENERIC_RETRYABLE = 'Something went wrong on our side. Try again.'
const GENERIC_RELOAD = 'Something went wrong on our side. Reload the page and check again.'
const TOO_LONG = 'The request took too long. Try again.'

// One row per row of the UI-SPEC "Errors" table: the code, the flag the envelope carries, and the
// sentence the user reads. The sentences are written out here so a change to the shared table
// cannot pass unnoticed.
const ROWS: readonly (readonly [string, boolean, string])[] = [
  [
    'ai_not_configured',
    false,
    'AI is not set up. Add GEMINI_API_KEY to server/.env and restart the server.',
  ],
  [
    'ai_auth_failed',
    false,
    'Google did not accept the AI key. Check GEMINI_API_KEY in server/.env and restart the server.',
  ],
  [
    'ai_billing',
    false,
    'The Google project behind the key has no credit or billing set up. Fix it in Google AI Studio, then try again.',
  ],
  [
    'ai_rate_limited',
    true,
    "Google's AI is rate limiting this key. Wait a while, then try again. If it keeps happening, a daily quota may be used up: check your usage in Google AI Studio.",
  ],
  ['ai_overloaded', true, "Google's AI is busy right now. Try again in a moment."],
  ['ai_timeout', true, TOO_LONG],
  ['request_timeout', true, TOO_LONG],
  ['ai_network', true, "Could not reach Google's AI. Check your connection and try again."],
  [
    'ai_blocked',
    false,
    'The AI declined to process this resume and job, so no fit check was saved. Trying the same check again is unlikely to help.',
  ],
  ['ai_truncated', true, "The AI's answer was cut off. Try again."],
  ['ai_invalid_output', true, 'The AI returned something we could not use. Try again.'],
  ['ai_failed', true, GENERIC_RETRYABLE],
  ['too_many_requests', true, 'Too many requests in a short time. Wait a minute, then try again.'],
  [
    'forbidden_origin',
    false,
    "The app server refused this page's address. Open the app at http://localhost:5173 or set ALLOWED_ORIGINS.",
  ],
  ['server_unreachable', true, "Can't reach the app server (is it running?)"],
  ['internal_error', true, GENERIC_RETRYABLE],
  ['validation_error', false, GENERIC_RELOAD],
  ['not_found', false, GENERIC_RELOAD],
  ['unsupported_media_type', false, GENERIC_RELOAD],
  ['payload_too_large', false, GENERIC_RELOAD],
]

test.each(ROWS)(
  '%s (retryable: %s) reads as its own sentence and passes the flag through',
  (code, retryable, message) => {
    const view = describeFitError(new ApiError(code, 'Server wording.', retryable))

    expect(view.code).toBe(code)
    expect(view.message).toBe(message)
    expect(view.retryable).toBe(retryable)
    expect(view.action).toBe(code === 'ai_blocked' ? 'edit_resume' : null)
  },
)

test('the retry flag is the envelope flag, never decided from the code', () => {
  expect(describeFitError(new ApiError('ai_rate_limited', 'x', false)).retryable).toBe(false)
  expect(describeFitError(new ApiError('validation_error', 'x', true)).retryable).toBe(true)
})

test('the error message is never the result', () => {
  for (const [code, retryable] of ROWS) {
    const view = describeFitError(new ApiError(code, 'Server wording.', retryable))
    expect(view.message).not.toContain('Server wording.')
  }
  const unknown = describeFitError(new ApiError('brand_new_code', 'Server wording.', true))
  expect(unknown.message).not.toContain('Server wording.')
})

test('an unknown code falls back by its retryable flag', () => {
  const retryable = describeFitError(new ApiError('brand_new_code', 'x', true))
  expect(retryable).toEqual({
    code: 'brand_new_code',
    message: GENERIC_RETRYABLE,
    retryable: true,
    action: null,
  })

  const fixed = describeFitError(new ApiError('brand_new_code', 'x', false))
  expect(fixed).toEqual({
    code: 'brand_new_code',
    message: GENERIC_RELOAD,
    retryable: false,
    action: null,
  })
})

test('codes are matched exactly: a different case or a trailing space is an unknown code', () => {
  expect(describeFitError(new ApiError('AI_TIMEOUT', 'x', true)).message).toBe(GENERIC_RETRYABLE)
  expect(describeFitError(new ApiError('ai_timeout ', 'x', true)).message).toBe(GENERIC_RETRYABLE)
  expect(describeFitError(new ApiError('AI_TIMEOUT', 'x', false)).message).toBe(GENERIC_RELOAD)
  expect(describeFitError(new ApiError('ai_timeout ', 'x', false)).message).toBe(GENERIC_RELOAD)
})

test('the stopped-server sentence does not depend on what the error said', () => {
  const view = describeFitError(new ApiError('server_unreachable', 'anything', true))
  expect(view.message).toBe("Can't reach the app server (is it running?)")
})

test('anything that is not an ApiError is the generic retryable failure', () => {
  const expected = {
    code: 'internal_error',
    message: GENERIC_RETRYABLE,
    retryable: true,
    action: null,
  }
  expect(describeFitError(new Error('Server wording.'))).toEqual(expected)
  expect(describeFitError('Server wording.')).toEqual(expected)
  expect(describeFitError(undefined)).toEqual(expected)
})
