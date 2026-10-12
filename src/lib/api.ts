import { apiErrorSchema } from '@jobs-workspace/shared'
import type { z } from 'zod'

const UNREACHABLE_MESSAGE = "Can't reach the app server (is it running?)"
const TIMEOUT_MESSAGE = 'The request took too long. Try again.'
const GENERIC_MESSAGE = 'Something went wrong on our side. Try again.'
export const DEFAULT_TIMEOUT_MS = 60_000

// `code` is a plain string because the server may add codes an older client does not know; the
// message is always safe to show.
export class ApiError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(code: string, message: string, retryable: boolean) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.retryable = retryable
  }
}

interface ApiRequestOptions<T> {
  path: string
  method?: 'GET' | 'POST'
  body?: unknown
  schema: z.ZodType<T>
  timeoutMs?: number
}

// AbortSignal.timeout rejects with a DOMException named TimeoutError. Checked by name, not by
// class, because a DOMException is not an Error instance in every environment.
function isTimeoutError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'TimeoutError'
  )
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    return undefined
  }
}

// The one place the browser talks to the server: same-origin /api paths only. It is called from
// TanStack Query functions, never from a component or an effect. Every response, and every error
// envelope, is parsed with a shared schema before it reaches the caller.
export async function apiRequest<T>(options: ApiRequestOptions<T>): Promise<T> {
  const { path, method = 'GET', body, schema, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    // The browser's own deadline is a timeout; any other rejection is a network failure.
    if (isTimeoutError(error)) {
      throw new ApiError('request_timeout', TIMEOUT_MESSAGE, true)
    }
    throw new ApiError('server_unreachable', UNREACHABLE_MESSAGE, true)
  }

  const payload = await readJson(response)

  if (!response.ok) {
    const envelope = apiErrorSchema.safeParse(payload)
    if (envelope.success) {
      const { code, message, retryable } = envelope.data.error
      throw new ApiError(code, message, retryable)
    }
    // The dev and preview proxy answers an empty 502 when the app server is down. A 5xx with no
    // envelope is "the server did not answer", not an internal error of ours.
    if (response.status >= 500) throw new ApiError('server_unreachable', UNREACHABLE_MESSAGE, true)
    throw new ApiError('internal_error', GENERIC_MESSAGE, true)
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) throw new ApiError('internal_error', GENERIC_MESSAGE, true)
  return parsed.data
}
