import type { Job } from '@jobs-workspace/shared'
import { useQuery } from '@tanstack/react-query'

import { jobsQueryOptions } from './queries'

interface JobPickerProps {
  selectedJobId: string | null
  onSelect: (job: Job) => void
}

export function JobPicker({ selectedJobId, onSelect }: JobPickerProps) {
  const jobs = useQuery(jobsQueryOptions)

  return (
    <section aria-labelledby="job-picker-heading" className="mb-6">
      <h2 id="job-picker-heading" className="mb-2 text-lg font-semibold">
        Jobs
      </h2>
      {jobs.isPending ? <p role="status">Loading jobs</p> : null}
      {jobs.isError ? <p role="alert">Could not load jobs. Reload the page to try again.</p> : null}
      {jobs.data ? (
        <ul className="space-y-1">
          {jobs.data.jobs.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                aria-current={job.id === selectedJobId ? 'true' : undefined}
                onClick={() => {
                  onSelect(job)
                }}
                className="rounded border border-neutral-300 px-3 py-1 text-left aria-[current=true]:border-blue-700 aria-[current=true]:bg-blue-50"
              >
                {job.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
