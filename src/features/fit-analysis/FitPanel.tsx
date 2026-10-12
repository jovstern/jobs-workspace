import type { Job } from '@jobs-workspace/shared'
import { Progress } from 'radix-ui'
import { useId, useRef } from 'react'

import { Button } from '../../components/Button'
import { AdviceMissingNotice } from './AdviceMissingNotice'
import { FitErrorNotice } from './FitErrorNotice'
import { FitProgress } from './FitProgress'
import { describeFitError } from './fit-errors'
import { useFitStore } from './fit-store'
import { useCheckFit, useIsCheckingFit } from './mutations'
import { FIT_REASSURANCE } from './progress-lines'
import { GapsSection } from './GapsSection'
import { RequirementsSection } from './RequirementsSection'
import { ScoreBlock } from './ScoreBlock'
import { buildFitView, selectCurrentAnalysis } from './selectors'
import { TailoringSection } from './TailoringSection'

interface FitPanelProps {
  job: Job
  resume: { text: string; textHash: string } | null
  unavailableReason?: string
}

const NO_RESUME_REASON = 'Add your resume to check your fit.'
const NO_RESULT_TEXT =
  'No fit check yet. Select Check my fit to compare your resume with these requirements.'

// The fit region of the job detail. A check starts only from a click handler here: never on
// render, selection, refresh, focus, a timer or a reconnect. The result is derived in render from
// the stored ratings; nothing about the score is kept in state.
export function FitPanel({ job, resume, unavailableReason }: FitPanelProps) {
  const reasonId = useId()
  const byJobId = useFitStore((state) => state.byJobId)
  const checkFit = useCheckFit()
  const isChecking = useIsCheckingFit(job.id)
  // The persistent action button (header Check again, or Check my fit while there is no result),
  // and whether focus should go to the header one as soon as it exists. Both are read and written
  // only in event handlers and the ref callback, never during render.
  const actionButton = useRef<HTMLButtonElement | null>(null)
  const focusWhenShown = useRef(false)

  const analysis = selectCurrentAnalysis(byJobId, job, resume?.textHash ?? null)
  const view = analysis ? buildFitView(job, analysis) : null

  const reason = unavailableReason ?? (resume === null ? NO_RESUME_REASON : undefined)
  const isUnavailable = reason !== undefined || isChecking

  const failure = checkFit.isError ? describeFitError(checkFit.error) : null

  function setActionButton(element: HTMLButtonElement | null) {
    actionButton.current = element
    if (element !== null && focusWhenShown.current) {
      focusWhenShown.current = false
      element.focus()
    }
  }

  // The control just used goes away when the check starts (Check my fit, the old-result notice or
  // the error notice), so focus moves to the persistent action button: now if it exists, and for a
  // first result also as soon as the header Check again appears.
  function holdFocus() {
    if (actionButton.current !== null) actionButton.current.focus()
    if (view === null) focusWhenShown.current = true
  }

  function startCheck(moveFocus: boolean) {
    if (isUnavailable || resume === null) return
    if (moveFocus) holdFocus()
    checkFit.mutate({ jobId: job.id, resumeText: resume.text, resumeHash: resume.textHash })
  }

  // One click is one request, and it is ignored while a check runs or the panel is unavailable.
  // It sends the current resume, not the one captured by the failed attempt.
  function retry() {
    startCheck(true)
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
            ref={setActionButton}
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

      {isChecking ? (
        <p className="text-base font-semibold text-gray-900">Checking your fit</p>
      ) : null}

      {/* The only live region of the panel, always mounted. While a check runs it holds just the
          stage line, so only a change of stage is announced; the heading, the reassurance and the
          bar stay outside it. */}
      <div role="status" className={isChecking ? undefined : 'sr-only'}>
        {isChecking ? <FitProgress /> : completion}
      </div>

      {isChecking ? (
        <>
          <p className="text-sm text-gray-600">{FIT_REASSURANCE}</p>
          <Progress.Root
            aria-label="Checking your fit"
            className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
          >
            <Progress.Indicator className="h-full w-full animate-pulse rounded-full bg-blue-700 motion-reduce:animate-none" />
          </Progress.Root>
        </>
      ) : null}

      {!isChecking && failure ? <FitErrorNotice error={failure} onRetry={retry} /> : null}

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
              <GapsSection
                key={analysis.analysedAt}
                gaps={view.gaps}
                hasAdvice={view.hasAdvice}
                notice={
                  view.hasAdvice ? null : (
                    <AdviceMissingNotice
                      onCheckAgain={() => {
                        startCheck(true)
                      }}
                      unavailable={isUnavailable}
                      describedBy={reason !== undefined ? reasonId : undefined}
                    />
                  )
                }
              />
            </div>
          ) : null}
          {view.hasAdvice ? (
            <div className="mt-12">
              <TailoringSection tailoring={view.tailoring} />
            </div>
          ) : null}
        </>
      ) : null}

      {view === null ? (
        <div className="flex flex-col items-start gap-4">
          {isChecking ? null : <p className="text-base text-gray-900">{NO_RESULT_TEXT}</p>}
          <Button
            variant="primary"
            ref={setActionButton}
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
