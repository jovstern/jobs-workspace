import type { ErrorCode } from '@jobs-workspace/shared'

import type { AiFailureDiagnostic } from './diagnose'

// Placeholder for the RED step: only the first rule exists, everything else is the generic code.
export function failureToErrorCode(diagnostic: AiFailureDiagnostic): ErrorCode {
  if (diagnostic.category === 'timeout') return 'ai_timeout'
  return 'ai_failed'
}
