import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import type { FitErrorView } from './fit-errors'

interface FitErrorNoticeProps {
  error: FitErrorView
  onRetry: () => void
}

// The danger notice for a failed check. The sentence is plain text from the fixed table; Try again
// exists only when the failure says a retry can help. It never takes focus, and no other control
// is offered, whatever `error.action` holds.
export function FitErrorNotice({ error, onRetry }: FitErrorNoticeProps) {
  return (
    <Notice tone="danger" role="alert" heading="Could not check your fit">
      <p className="text-base">{error.message}</p>
      {error.retryable ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Notice>
  )
}
