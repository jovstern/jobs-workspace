import type { Job } from '@jobs-workspace/shared'
import { Progress } from 'radix-ui'
import { useId, useState } from 'react'

import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import { ApiError } from '../../lib/api'
import { useFitStore } from './fit-store'
import { useCheckFit, useIsCheckingFit } from './mutations'
import { GapsSection } from './GapsSection'
import { RequirementsSection } from './RequirementsSection'
import { ScoreBlock } from './ScoreBlock'
import { buildFitView, selectCurrentAnalysis } from './selectors'

interface FitPanelProps {
  job: Job
  resume: { text: string; textHash: string } | null
  unavailableReason?: string
}

const NO_RESUME_REASON = 'Add your resume to check your fit.'
const NO_RESULT_TEXT =
  'No fit check yet. Select Check my fit to compare your resume with these requirements.'
const GENERIC_ERROR = 'Something went wrong on our side. Try again.'
const NOT_CONFIGURED_ERROR =
  'AI is not set up. Add GEMINI_API_KEY to server/.env and restart the server.'

// Runs once when the element is added to the page; the identity is stable so it never re-runs.
function focusOnMount(element: HTMLElement | null) {
  element?.focus()
}

// The fit region of the job detail. A check starts only from a click handler here: never on
// render, selection, refresh, focus, a timer or a reconnect. The result is derived in render from
// the stored ratings; nothing about the score is kept in state.
export function FitPanel({ job, resume, unavailableReason }: FitPanelProps) {
  const reasonId = useId()
  const byJobId = useFitStore((state) => state.byJobId)
  const checkFit = useCheckFit()
  const isChecking = useIsCheckingFit(job.id)
  const [focusRerun, setFocusRerun] = useState(false)

  const analysis = selectCurrentAnalysis(byJobId, job, resume?.textHash ?? null)
  const view = analysis ? buildFitView(job, analysis) : null

  const reason = unavailableReason ?? (resume === null ? NO_RESUME_REASON : undefined)
  const isUnavailable = reason !== undefined || isChecking

  const failure = checkFit.isError ? checkFit.error : null
  const notConfigured = failure instanceof ApiError && failure.code === 'ai_not_configured'

  function startCheck(fromPrimary: boolean) {
    if (isUnavailable || resume === null) return
    if (fromPrimary) setFocusRerun(true)
    checkFit.mutate({ jobId: job.id, resumeText: resume.text, resumeHash: resume.textHash })
  }

  function retry() {
    if (isChecking || !checkFit.variables) return
    checkFit.mutate(checkFit.variables)
  }

  const completion =
    checkFit.isSuccess && view?.score != null && view.band !== null
      ? `Fit check complete. Fit estimate ${String(view.score)}%, ${view.band}.`
      : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="min-w-0 text-xl leading-[1.2] font-semibold break-words text-gray-900">
          Your fit for {job.title}
        </h2>
        {view ? (
          <Button
            variant="secondary"
            aria-disabled={isUnavailable}
            aria-describedby={reason !== undefined ? reasonId : undefined}
            ref={focusRerun ? focusOnMount : undefined}
            onClick={() => {
              startCheck(false)
            }}
          >
            Check again
          </Button>
        ) : null}
      </div>

      {reason !== undefined ? (
        <p id={reasonId} className="text-sm text-gray-600">
          {reason}
        </p>
      ) : null}

      <div role="status" className={isChecking ? 'flex flex-col gap-2' : 'sr-only'}>
        {isChecking ? (
          <>
            <p className="text-base font-semibold text-gray-900">Checking your fit</p>
            <p className="text-sm text-gray-600">Usually 10 to 20 seconds.</p>
          </>
        ) : (
          completion
        )}
      </div>

      {isChecking ? (
        <Progress.Root
          aria-label="Checking your fit"
          className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
        >
          <Progress.Indicator className="h-full w-full animate-pulse rounded-full bg-blue-700 motion-reduce:animate-none" />
        </Progress.Root>
      ) : null}

      {!isChecking && failure ? (
        <Notice tone="danger" role="alert" heading="Could not check your fit">
          <p className="text-base">{notConfigured ? NOT_CONFIGURED_ERROR : GENERIC_ERROR}</p>
          {notConfigured ? null : (
            <Button variant="secondary" onClick={retry}>
              Try again
            </Button>
          )}
        </Notice>
      ) : null}

      {!isChecking && view ? (
        <>
          {view.score !== null && view.band !== null && analysis ? (
            <ScoreBlock
              score={view.score}
              band={view.band}
              requiredMet={view.requiredMet}
              requiredTotal={view.requiredTotal}
              analysedAt={analysis.analysedAt}
            />
          ) : null}
          <div className="mt-12">
            <RequirementsSection required={view.required} niceToHave={view.niceToHave} />
          </div>
          {analysis ? (
            <div className="mt-12">
              <GapsSection key={analysis.analysedAt} gaps={view.gaps} hasAdvice={view.hasAdvice} />
            </div>
          ) : null}
        </>
      ) : null}

      {view === null ? (
        <div className="flex flex-col items-start gap-4">
          {isChecking ? null : <p className="text-base text-gray-900">{NO_RESULT_TEXT}</p>}
          <Button
            variant="primary"
            aria-disabled={isUnavailable}
            aria-describedby={reason !== undefined ? reasonId : undefined}
            onClick={() => {
              startCheck(true)
            }}
          >
            Check my fit
          </Button>
        </div>
      ) : null}
    </div>
  )
}
