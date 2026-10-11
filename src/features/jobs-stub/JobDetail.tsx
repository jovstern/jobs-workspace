import type { Job } from '@jobs-workspace/shared'
import { useId } from 'react'

import { Card } from '../../components/Card'
import { FitPanel } from '../fit-analysis/FitPanel'

interface JobDetailProps {
  job: Job
  resume: { text: string; textHash: string } | null
}

// The posting first, exactly as the model will rate it, then the fit region. The fit panel owns
// the Check my fit action and everything that follows it.
export function JobDetail({ job, resume }: JobDetailProps) {
  const headingId = useId()
  const required = job.requirements.filter((requirement) => requirement.kind === 'required')
  const niceToHave = job.requirements.filter((requirement) => requirement.kind === 'nice_to_have')

  return (
    <Card labelledBy={headingId}>
      <h2 id={headingId} className="text-xl leading-[1.2] font-semibold break-words text-gray-900">
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
        <FitPanel job={job} resume={resume} />
      </div>
    </Card>
  )
}
