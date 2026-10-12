// What a failed model call may report about itself: an HTTP status number and a category from a
// fixed list. Never an error message, a response body, a key, a prompt or any resume text.
export const FAILURE_CATEGORIES = [
  'INVALID_ARGUMENT',
  'FAILED_PRECONDITION',
  'UNAUTHENTICATED',
  'PERMISSION_DENIED',
  'NOT_FOUND',
  'RESOURCE_EXHAUSTED',
  'INTERNAL',
  'UNAVAILABLE',
  'DEADLINE_EXCEEDED',
  'timeout',
  'aborted',
  'network',
  'blocked',
  'unfinished',
  'empty_text',
  'invalid_json',
  'schema_mismatch',
  'unknown',
] as const

export type FailureCategory = (typeof FAILURE_CATEGORIES)[number]

// Class names that may be reported. Anything else is reported as 'other', so a custom error
// whose name carries text can never reach a diagnostic.
export const ERROR_CLASS_NAMES = [
  'ApiError',
  'ClientError',
  'ServerError',
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'ZodError',
  'AbortError',
  'TimeoutError',
  'AppError',
  'other',
] as const

export type ErrorClassName = (typeof ERROR_CLASS_NAMES)[number]

export interface AiFailureDiagnostic {
  httpStatus: number | null
  category: FailureCategory
  // null when the thrown value was not an Error, or when the failure was not an exception.
  errorClass: ErrorClassName | null
}

// Google's own status labels by HTTP status. Used instead of anything in the error text.
const CATEGORY_BY_HTTP_STATUS: Record<number, FailureCategory> = {
  400: 'INVALID_ARGUMENT',
  401: 'UNAUTHENTICATED',
  403: 'PERMISSION_DENIED',
  404: 'NOT_FOUND',
  429: 'RESOURCE_EXHAUSTED',
  500: 'INTERNAL',
  503: 'UNAVAILABLE',
  504: 'DEADLINE_EXCEEDED',
}

function httpStatusOf(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null
  const { status } = error
  if (typeof status !== 'number' || !Number.isInteger(status)) return null
  return status >= 100 && status <= 599 ? status : null
}

// The error text is searched for fixed tokens and nothing else is read from it. It is never
// copied, so a message that echoes a prompt or a resume cannot reach a diagnostic.
function messageNamesFailedPrecondition(error: unknown): boolean {
  return error instanceof Error && error.message.includes('FAILED_PRECONDITION')
}

// The second fixed token: Google answers a key it does not know with a 400, not a 401 or 403.
function messageNamesInvalidKey(error: unknown): boolean {
  return error instanceof Error && error.message.includes('API_KEY_INVALID')
}

function errorClassOf(error: unknown): ErrorClassName | null {
  if (!(error instanceof Error)) return null
  const known = ERROR_CLASS_NAMES.find((name) => name === error.name)
  return known ?? 'other'
}

// Reduces any thrown value to a status number, a category and a class name, each from a fixed list.
export function diagnoseError(error: unknown): AiFailureDiagnostic {
  const errorClass = errorClassOf(error)
  const httpStatus = httpStatusOf(error)
  if (httpStatus !== null) {
    if (httpStatus === 400 && messageNamesFailedPrecondition(error)) {
      return { httpStatus, category: 'FAILED_PRECONDITION', errorClass }
    }
    if (httpStatus === 400 && messageNamesInvalidKey(error)) {
      return { httpStatus, category: 'UNAUTHENTICATED', errorClass }
    }
    return { httpStatus, category: CATEGORY_BY_HTTP_STATUS[httpStatus] ?? 'unknown', errorClass }
  }
  switch (error instanceof Error ? error.name : '') {
    case 'TimeoutError':
      return { httpStatus: null, category: 'timeout', errorClass }
    case 'AbortError':
      return { httpStatus: null, category: 'aborted', errorClass }
    case 'TypeError':
      return { httpStatus: null, category: 'network', errorClass }
    case 'SyntaxError':
      return { httpStatus: null, category: 'invalid_json', errorClass }
    default:
      return { httpStatus: null, category: 'unknown', errorClass }
  }
}
