import { z } from 'zod'

export const ERROR_CODES = [
  'ai_not_configured',
  'ai_auth_failed',
  'ai_billing',
  'ai_rate_limited',
  'ai_overloaded',
  'ai_timeout',
  'ai_network',
  'ai_blocked',
  'ai_truncated',
  'ai_invalid_output',
  'ai_failed',
  'validation_error',
  'not_found',
  'too_many_requests',
  'forbidden_origin',
  'unsupported_media_type',
  'payload_too_large',
  'internal_error',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export function isKnownErrorCode(code: string): code is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(code)
}

export const GENERIC_RETRYABLE_MESSAGE = 'Something went wrong on our side. Try again.'
export const GENERIC_NOT_RETRYABLE_MESSAGE =
  'Something went wrong on our side. Reload the page and check again.'

// The one sentence the user reads for each code. The server sends it and the page may show it,
// so nothing from a request, a provider or a thrown error is ever part of it.
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  ai_not_configured: 'AI is not set up. Add GEMINI_API_KEY to server/.env and restart the server.',
  ai_auth_failed:
    'Google did not accept the AI key. Check GEMINI_API_KEY in server/.env and restart the server.',
  ai_billing:
    'The Google project behind the key has no credit or billing set up. Fix it in Google AI Studio, then try again.',
  ai_rate_limited:
    "Google's AI is rate limiting this key. Wait a while, then try again. If it keeps happening, a daily quota may be used up: check your usage in Google AI Studio.",
  ai_overloaded: "Google's AI is busy right now. Try again in a moment.",
  ai_timeout: 'The request took too long. Try again.',
  ai_network: "Could not reach Google's AI. Check your connection and try again.",
  ai_blocked:
    'The AI declined to process this resume and job, so no fit check was saved. Trying the same check again is unlikely to help.',
  ai_truncated: "The AI's answer was cut off. Try again.",
  ai_invalid_output: 'The AI returned something we could not use. Try again.',
  ai_failed: GENERIC_RETRYABLE_MESSAGE,
  too_many_requests: 'Too many requests in a short time. Wait a minute, then try again.',
  forbidden_origin:
    "The app server refused this page's address. Open the app at http://localhost:5173 or set ALLOWED_ORIGINS.",
  internal_error: GENERIC_RETRYABLE_MESSAGE,
  validation_error: GENERIC_NOT_RETRYABLE_MESSAGE,
  not_found: GENERIC_NOT_RETRYABLE_MESSAGE,
  unsupported_media_type: GENERIC_NOT_RETRYABLE_MESSAGE,
  payload_too_large: GENERIC_NOT_RETRYABLE_MESSAGE,
}

// The wire `code` is a plain string on purpose: a later phase can add codes without breaking an
// older client, which falls back to the generic message for a code it does not know.
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorSchema>
