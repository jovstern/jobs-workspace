import type { Job, Rating } from '@jobs-workspace/shared'

import { ApiError } from '../../lib/api'
import { useFitStore } from './fit-store'
import { useCheckFit, useIsCheckingFit } from './mutations'

interface FitPanelProps {
  job: Job
  resume: { text: string; textHash: string } | null
  unavailableReason?: string
}

const RATING_LABELS: Record<Rating, string> = {
  met: 'Met',
  partial: 'Partial',
  not_evidenced: 'Not evidenced',
}

const GENERIC_ERROR = 'Something went wrong on our side. Try again.'

export function FitPanel({ job, resume, unavailableReason }: FitPanelProps) {
  const analysis = useFitStore((state) => state.byJobId[job.id])
  const checkFit = useCheckFit()
  const isChecking = useIsCheckingFit(job.id)

  const isBlocked = resume === null || unavailableReason !== undefined || isChecking
  const failure = checkFit.isError ? checkFit.error : null
  const failureMessage = failure instanceof ApiError ? failure.message : GENERIC_ERROR
  const canRetry = !(failure instanceof ApiError) || failure.retryable

  function startCheck() {
    if (isBlocked) return
    checkFit.mutate({ jobId: job.id, resumeText: resume.text, resumeHash: resume.textHash })
  }

  function retry() {
    if (isChecking || !checkFit.variables) return
    checkFit.mutate(checkFit.variables)
  }

  return (
    <section aria-labelledby="fit-heading">
      <h2 id="fit-heading" className="mb-2 text-lg font-semibold">
        {job.title}
      </h2>

      {analysis ? (
        <ol aria-label="Rated requirements" className="space-y-3">
          {analysis.ratings.map((rating) => {
            const requirement = job.requirements.find((item) => item.id === rating.requirementId)
            if (!requirement) return null
            return (
              <li key={rating.requirementId}>
                <p>{requirement.text}</p>
                <p className="font-medium">{RATING_LABELS[rating.rating]}</p>
                {rating.rating !== 'not_evidenced' && rating.quote !== null ? (
                  <p className="text-neutral-700">
                    <span>From your resume:</span> {rating.quote}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : (
        <div>
          {isChecking ? <p role="status">Checking your fit</p> : null}
          {unavailableReason !== undefined ? <p>{unavailableReason}</p> : null}
          {failure ? (
            <div role="alert">
              <p>{failureMessage}</p>
              {canRetry ? (
                <button
                  type="button"
                  aria-disabled={isChecking}
                  onClick={retry}
                  className="mt-1 rounded border border-neutral-400 px-3 py-1"
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            aria-disabled={isBlocked}
            onClick={startCheck}
            className="mt-2 rounded bg-blue-700 px-4 py-2 text-white aria-disabled:opacity-50"
          >
            Check my fit
          </button>
        </div>
      )}
    </section>
  )
}
