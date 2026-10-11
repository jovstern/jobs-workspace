import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { Card } from './components/Card'
import { JobDetail } from './features/jobs-stub/JobDetail'
import { JobPicker } from './features/jobs-stub/JobPicker'
import { jobsQueryOptions } from './features/jobs-stub/queries'
import { ResumeCard } from './features/resume/ResumeCard'
import { useResumeStore } from './features/resume/resume-store'

const HEADING = 'text-xl leading-[1.2] font-semibold text-gray-900'

// Temporary page: Phase 2 replaces the layout. The resume comes from its persisted store; the
// selected job id lives in component state only, and the job itself is read from the query cache.
// Below the lg breakpoint the layout is one column with the jobs list first.
export function App() {
  const emptyHeadingId = useId()
  const resume = useResumeStore((state) => state.resume)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const jobs = useQuery(jobsQueryOptions)
  const selectedJob = jobs.data?.jobs.find((job) => job.id === selectedJobId)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header>
          <h1 className={HEADING}>Jobs Workspace</h1>
          <p className="mt-1 text-base text-gray-600">
            Pick a job to see how your resume matches its requirements.
          </p>
        </header>

        <main className="mt-6 flex flex-col gap-6">
          <ResumeCard />

          <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
            <JobPicker
              selectedJobId={selectedJobId}
              onSelect={(job) => {
                setSelectedJobId(job.id)
              }}
            />

            {selectedJob ? (
              <JobDetail key={selectedJob.id} job={selectedJob} resume={resume} />
            ) : (
              <Card labelledBy={emptyHeadingId}>
                <h2 id={emptyHeadingId} className={HEADING}>
                  Select a job
                </h2>
                <p className="mt-2 text-base text-gray-600">
                  Choose a job on the left to read its requirements and check your fit.
                </p>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
