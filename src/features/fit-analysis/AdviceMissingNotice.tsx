import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'

interface AdviceMissingNoticeProps {
  onCheckAgain: () => void
  // The same unavailable state as the header button: aria-disabled, never the disabled attribute.
  unavailable: boolean
  describedBy?: string
}

// Shown under the Gaps heading for a result saved before learning plans existed.
export function AdviceMissingNotice({
  onCheckAgain,
  unavailable,
  describedBy,
}: AdviceMissingNoticeProps) {
  return (
    <div className="mt-2">
      <Notice tone="neutral" role="status">
        <div className="flex w-full flex-wrap items-center justify-between gap-4">
          <p className="min-w-0 text-base">
            Learning plans and tailoring tips are new. Check again to add them to this result.
          </p>
          <Button
            variant="secondary"
            aria-label="Check again to add learning plans and tips"
            aria-disabled={unavailable}
            aria-describedby={describedBy}
            onClick={onCheckAgain}
          >
            Check again
          </Button>
        </div>
      </Notice>
    </div>
  )
}
