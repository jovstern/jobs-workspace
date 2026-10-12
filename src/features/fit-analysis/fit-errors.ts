import {
  ERROR_MESSAGES,
  GENERIC_NOT_RETRYABLE_MESSAGE,
  GENERIC_RETRYABLE_MESSAGE,
  isKnownErrorCode,
} from '@jobs-workspace/shared'

import { ApiError } from '../../lib/api'

export interface FitErrorView {
  code: string
  message: string
  retryable: boolean
  // Data for Phase 01.2 (the Edit resume control). Nothing renders it in this phase.
  action: 'edit_resume' | null
}

// Codes only the browser can raise: the request never produced an envelope.
const BROWSER_ONLY_MESSAGES: Record<string, string> = {
  server_unreachable: "Can't reach the app server (is it running?)",
  request_timeout: 'The request took too long. Try again.',
}

function messageFor(code: string, retryable: boolean): string {
  // Own-property check: a code such as "constructor" must not find an inherited member.
  if (Object.hasOwn(BROWSER_ONLY_MESSAGES, code)) return BROWSER_ONLY_MESSAGES[code] ?? ''
  if (isKnownErrorCode(code)) return ERROR_MESSAGES[code]
  return retryable ? GENERIC_RETRYABLE_MESSAGE : GENERIC_NOT_RETRYABLE_MESSAGE
}

// What the user reads for a failed check. The sentence is looked up by `code` as an exact string
// and is never the error's own message, so nothing from the server, the provider, the prompt or
// the resume can reach the page. The retry flag is the envelope's own.
export function describeFitError(failure: unknown): FitErrorView {
  if (!(failure instanceof ApiError)) {
    return {
      code: 'internal_error',
      message: GENERIC_RETRYABLE_MESSAGE,
      retryable: true,
      action: null,
    }
  }
  return {
    code: failure.code,
    message: messageFor(failure.code, failure.retryable),
    retryable: failure.retryable,
    action: failure.code === 'ai_blocked' ? 'edit_resume' : null,
  }
}
