import type { Job } from '@jobs-workspace/shared'
import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'

import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Notice } from '../../components/Notice'
import { JobRow } from './JobRow'
import { jobsQueryOptions } from './queries'

interface JobPickerProps {
  selectedJobId: string | null
  onSelect: (job: Job) => void
}

// Phase 2 replaces this list with search and result cards. Until then it only needs to list the
// seed jobs honestly: loading, failed, empty and populated.
export function JobPicker({ selectedJobId, onSelect }: JobPickerProps) {
  const headingId = useId()
  const jobs = useQuery(jobsQueryOptions)

  return (
    <Card labelledBy={headingId}>
      <h2 id={headingId} className="mb-4 text-xl leading-[1.2] font-semibold text-gray-900">
        Jobs
      </h2>
      {jobs.isPending ? (
        <p role="status" className="text-base text-gray-600">
          Loading jobs
        </p>
      ) : null}
      {jobs.isError ? (
        <Notice tone="danger" role="alert">
          <p>Could not load the jobs. Check that the app server is running.</p>
          <Button
            variant="secondary"
            onClick={() => {
              void jobs.refetch()
            }}
          >
            Try again
          </Button>
        </Notice>
      ) : null}
      {jobs.data?.jobs.length === 0 ? (
        <p className="text-base text-gray-600">
          No jobs to show. Check that the app server has its seed data.
        </p>
      ) : null}
      {jobs.data && jobs.data.jobs.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {jobs.data.jobs.map((job) => (
            <li key={job.id} className="min-w-0">
              <JobRow job={job} selected={job.id === selectedJobId} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}
