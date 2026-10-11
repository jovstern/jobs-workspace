import type { ErrorRequestHandler, RequestHandler } from 'express'
import { z } from 'zod'

import type { ApiErrorBody, ErrorCode } from '@jobs-workspace/shared'

interface ErrorShape {
  status: number
  retryable: boolean
}

const ERROR_TABLE: Record<ErrorCode, ErrorShape> = {
  ai_not_configured: { status: 503, retryable: false },
  ai_failed: { status: 502, retryable: true },
  validation_error: { status: 400, retryable: false },
  not_found: { status: 404, retryable: false },
  too_many_requests: { status: 429, retryable: true },
  forbidden_origin: { status: 403, retryable: false },
  unsupported_media_type: { status: 415, retryable: false },
  payload_too_large: { status: 413, retryable: false },
  internal_error: { status: 500, retryable: true },
}

// Phase 1 has one generic retryable message on purpose; the full table is Phase 01.1.
const NOT_CONFIGURED_MESSAGE =
  'AI is not set up. Add GEMINI_API_KEY to server/.env and restart the server.'
const GENERIC_MESSAGE = 'Something went wrong on our side. Try again.'

function publicMessage(code: ErrorCode): string {
  return code === 'ai_not_configured' ? NOT_CONFIGURED_MESSAGE : GENERIC_MESSAGE
}

// An error the route layer chose to send. The message is fixed per code, so nothing from a
// request, a resume or a model answer can end up in a response through it.
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly retryable: boolean

  constructor(code: ErrorCode) {
    super(publicMessage(code))
    this.name = 'AppError'
    this.code = code
    this.status = ERROR_TABLE[code].status
    this.retryable = ERROR_TABLE[code].retryable
  }
}

// Validates a request body at the route boundary. Issues are not echoed back.
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) throw new AppError('validation_error')
  return result.data
}

export const notFoundHandler: RequestHandler = () => {
  throw new AppError('not_found')
}

function bodyParserErrorType(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) return undefined
  return typeof error.type === 'string' ? error.type : undefined
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  const type = bodyParserErrorType(error)
  if (type === 'entity.too.large') return new AppError('payload_too_large')
  if (type === 'entity.parse.failed') return new AppError('validation_error')
  return new AppError('internal_error')
}

// The thrown message is never echoed: anything that is not an AppError becomes internal_error.
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error)
    return
  }
  const appError = toAppError(error)
  const body: ApiErrorBody = {
    error: { code: appError.code, message: appError.message, retryable: appError.retryable },
  }
  res.status(appError.status).json(body)
}
