import type { ErrorCode } from '@jobs-workspace/shared'

import type { AiFailureDiagnostic } from './diagnose'

// The one rule from a closed failure diagnostic to an error code. It sees a status number and a
// category and nothing else, so no provider text, prompt, resume or key can reach a code. First
// match wins, so a missed deadline or a declined answer beats whatever status came with it.
export function failureToErrorCode({ httpStatus, category }: AiFailureDiagnostic): ErrorCode {
  if (category === 'timeout') return 'ai_timeout'
  if (category === 'blocked') return 'ai_blocked'
  if (category === 'unfinished') return 'ai_truncated'
  if (category === 'empty_text' || category === 'invalid_json' || category === 'schema_mismatch') {
    return 'ai_invalid_output'
  }
  if (category === 'network') return 'ai_network'
  if (httpStatus === 401 || httpStatus === 403 || category === 'UNAUTHENTICATED') {
    return 'ai_auth_failed'
  }
  if (httpStatus === 402 || category === 'FAILED_PRECONDITION') return 'ai_billing'
  if (httpStatus === 429) return 'ai_rate_limited'
  if (httpStatus !== null && httpStatus >= 500) return 'ai_overloaded'
  return 'ai_failed'
}
