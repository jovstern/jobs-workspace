import { canonicaliseResumeText, resumeTextSchema } from '@jobs-workspace/shared'
import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { Button } from './components/Button'
import { Card } from './components/Card'
import { JobDetail } from './features/jobs-stub/JobDetail'
import { JobPicker } from './features/jobs-stub/JobPicker'
import { jobsQueryOptions } from './features/jobs-stub/queries'

interface ResumeState {
  text: string
  textHash: string
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const HEADING = 'text-xl leading-[1.2] font-semibold text-gray-900'

// Temporary page: plan 01-08 replaces the resume field and Phase 2 replaces the layout. The resume
// and the selected job id live in component state only; the job itself is read from the query
// cache. Below the lg breakpoint the layout is one column with the jobs list first.
export function App() {
  const resumeHeadingId = useId()
  const resumeFieldId = useId()
  const emptyHeadingId = useId()
  const [draft, setDraft] = useState('')
  const [resume, setResume] = useState<ResumeState | null>(null)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const jobs = useQuery(jobsQueryOptions)
  const selectedJob = jobs.data?.jobs.find((job) => job.id === selectedJobId)

  async function handleUseText() {
    const text = canonicaliseResumeText(draft)
    const result = resumeTextSchema.safeParse(text)
    if (!result.success) {
      setResumeError(result.error.issues[0]?.message ?? 'This text cannot be used.')
      return
    }
    setResumeError(null)
    setResume({ text, textHash: await sha256Hex(text) })
  }

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
          <Card labelledBy={resumeHeadingId}>
            <h2 id={resumeHeadingId} className={HEADING}>
              Your resume
            </h2>
            <label htmlFor={resumeFieldId} className="mt-4 block text-sm font-semibold">
              Resume text
            </label>
            <textarea
              id={resumeFieldId}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
              }}
              rows={8}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-4 py-2 font-mono text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            />
            <div className="mt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  void handleUseText()
                }}
              >
                Use this text
              </Button>
            </div>
            {resumeError !== null ? (
              <p role="alert" className="mt-2 text-sm text-red-800">
                {resumeError}
              </p>
            ) : null}
            {resume !== null ? (
              <p role="status" className="mt-2 text-sm text-gray-600">
                Resume text ready
              </p>
            ) : null}
          </Card>

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
