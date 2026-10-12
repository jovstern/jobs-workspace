import { ERROR_CODES } from '@jobs-workspace/shared'
import type { ErrorCode } from '@jobs-workspace/shared'
import { describe, expect, test } from 'vitest'

import { FAILURE_CATEGORIES } from './diagnose'
import type { AiFailureDiagnostic, FailureCategory } from './diagnose'
import { failureToErrorCode } from './failure-code'

function diagnostic(httpStatus: number | null, category: FailureCategory): AiFailureDiagnostic {
  return { httpStatus, category, errorClass: null }
}

describe('failureToErrorCode', () => {
  test.each<[string, number | null, FailureCategory, ErrorCode]>([
    ['a missed deadline', null, 'timeout', 'ai_timeout'],
    ['a missed deadline, whatever the status', 500, 'timeout', 'ai_timeout'],
    ['a declined answer', null, 'blocked', 'ai_blocked'],
    ['a declined answer wins over a 429', 429, 'blocked', 'ai_blocked'],
    ['a cut-off answer', null, 'unfinished', 'ai_truncated'],
    ['an empty answer', null, 'empty_text', 'ai_invalid_output'],
    ['an answer that is not JSON', null, 'invalid_json', 'ai_invalid_output'],
    ['an answer that breaks the schema', null, 'schema_mismatch', 'ai_invalid_output'],
    ['an unreachable provider', null, 'network', 'ai_network'],
    ['HTTP 401', 401, 'UNAUTHENTICATED', 'ai_auth_failed'],
    ['HTTP 403', 403, 'PERMISSION_DENIED', 'ai_auth_failed'],
    ['HTTP 400 labelled UNAUTHENTICATED', 400, 'UNAUTHENTICATED', 'ai_auth_failed'],
    ['HTTP 402', 402, 'unknown', 'ai_billing'],
    ['HTTP 400 labelled FAILED_PRECONDITION', 400, 'FAILED_PRECONDITION', 'ai_billing'],
    ['HTTP 429', 429, 'RESOURCE_EXHAUSTED', 'ai_rate_limited'],
    ['HTTP 500', 500, 'INTERNAL', 'ai_overloaded'],
    ['HTTP 502', 502, 'unknown', 'ai_overloaded'],
    ['HTTP 503', 503, 'UNAVAILABLE', 'ai_overloaded'],
    ['HTTP 504', 504, 'DEADLINE_EXCEEDED', 'ai_overloaded'],
    ['HTTP 400 labelled INVALID_ARGUMENT', 400, 'INVALID_ARGUMENT', 'ai_failed'],
    ['HTTP 404', 404, 'NOT_FOUND', 'ai_failed'],
    ['an unmapped HTTP 418', 418, 'unknown', 'ai_failed'],
    ['an aborted call with no status', null, 'aborted', 'ai_failed'],
    ['an unknown failure with no status', null, 'unknown', 'ai_failed'],
  ])('%s gives its code', (_name, status, category, code) => {
    expect(failureToErrorCode(diagnostic(status, category))).toBe(code)
  })

  test('every category with every status gives a known code and never throws', () => {
    const statuses = [null, 400, 401, 402, 403, 404, 418, 429, 500, 502, 503, 504]
    for (const category of FAILURE_CATEGORIES) {
      for (const status of statuses) {
        const code = failureToErrorCode(diagnostic(status, category))
        expect(ERROR_CODES, `${String(status)} ${category}`).toContain(code)
      }
    }
  })

  test('the result depends on the status and the category only, not on the error class', () => {
    const base = diagnostic(429, 'RESOURCE_EXHAUSTED')

    expect(failureToErrorCode({ ...base, errorClass: 'ApiError' })).toBe(
      failureToErrorCode({ ...base, errorClass: 'other' }),
    )
    expect(failureToErrorCode({ ...base, errorClass: null })).toBe('ai_rate_limited')
  })
})
