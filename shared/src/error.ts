import { z } from 'zod'

export const ERROR_CODES = [
  'ai_not_configured',
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
