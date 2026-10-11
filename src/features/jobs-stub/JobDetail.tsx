import type { Job } from '@jobs-workspace/shared'
import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'

import { Card } from '../../components/Card'
import { Notice } from '../../components/Notice'
import { FitPanel } from '../fit-analysis/FitPanel'
import { healthQueryOptions } from './queries'

interface JobDetailProps {
  job: Job
  resume: { text: string; textHash: string } | null
}

const NOT_CONFIGURED_NOTICE =
  'AI is not set up. Add GEMINI_API_KEY to server/.env and restart the server. Fit checks are unavailable until then.'
const NOT_CONFIGURED_REASON = 'AI is not set up.'
const UNREACHABLE_NOTICE = "Can't reach the app server (is it running?)"

// The posting first, exactly as the model will rate it, then the fit region. The fit panel owns
// the Check my fit action and everything that follows it.
export function JobDetail({ job, resume }: JobDetailProps) {
  const headingId = useId()
  const health = useQuery(healthQueryOptions)
  const required = job.requirements.filter((requirement) => requirement.kind === 'required')
  const niceToHave = job.requirements.filter((requirement) => requirement.kind === 'nice_to_have')

  // While the answer is loading nothing is shown and the button stays available: an unanswered
  // question is not a reason to block. A failed request and "not configured" each get a notice and
  // the same reason on the button.
  let notice: string | null = null
  let unavailableReason: string | undefined
  if (health.isError) {
    notice = UNREACHABLE_NOTICE
    unavailableReason = UNREACHABLE_NOTICE
  } else if (health.data?.aiConfigured === false) {
    notice = NOT_CONFIGURED_NOTICE
    unavailableReason = NOT_CONFIGURED_REASON
  }

  return (
    <div className="flex flex-col gap-4">
      {notice !== null ? (
        <Notice tone="neutral" role="status">
          <p>{notice}</p>
        </Notice>
      ) : null}
      <Card labelledBy={headingId}>
        <h2
          id={headingId}
          className="text-xl leading-[1.2] font-semibold break-words text-gray-900"
        >
          {job.title}
        </h2>
        <p className="mt-1 text-sm break-words text-gray-600">
          {job.company} · {job.level} · {job.location}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {job.summary.map((paragraph) => (
            <p key={paragraph} className="text-base break-words text-gray-900">
              {paragraph}
            </p>
          ))}
        </div>

        <h3 className="mt-6 text-base font-semibold text-gray-900">Required</h3>
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-6">
          {required.map((requirement) => (
            <li key={requirement.id} className="text-base break-words text-gray-900">
              {requirement.text}
            </li>
          ))}
        </ul>

        <h3 className="mt-6 text-base font-semibold text-gray-900">Nice to have</h3>
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-6">
          {niceToHave.map((requirement) => (
            <li key={requirement.id} className="text-base break-words text-gray-900">
              {requirement.text}
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <FitPanel job={job} resume={resume} unavailableReason={unavailableReason} />
        </div>
      </Card>
    </div>
  )
}
