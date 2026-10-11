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

export interface AiFailureDiagnostic {
  httpStatus: number | null
  category: FailureCategory
}

// Placeholder body for the RED step; the real mapping follows.
export function diagnoseError(error: unknown): AiFailureDiagnostic {
  if (error instanceof Error) return { httpStatus: null, category: 'unknown' }
  return { httpStatus: null, category: 'unknown' }
}
