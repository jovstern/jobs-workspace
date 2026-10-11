import { canonicaliseResumeText, resumeTextSchema } from '@jobs-workspace/shared'
import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { FitPanel } from './features/fit-analysis/FitPanel'
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

// Temporary page: plan 01-05 replaces the layout and plan 01-08 replaces the resume field. The
// resume and the selected job id live in component state only; the job itself is read from the
// query cache.
export function App() {
  const resumeFieldId = useId()
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
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Jobs Workspace</h1>

      <section className="mb-6">
        <label htmlFor={resumeFieldId} className="mb-1 block font-medium">
          Resume text
        </label>
        <textarea
          id={resumeFieldId}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          rows={8}
          className="w-full rounded border border-neutral-300 p-2"
        />
        <button
          type="button"
          onClick={() => {
            void handleUseText()
          }}
          className="mt-2 rounded border border-neutral-400 px-3 py-1"
        >
          Use this text
        </button>
        {resumeError !== null ? <p role="alert">{resumeError}</p> : null}
        {resume !== null ? <p role="status">Resume text ready</p> : null}
      </section>

      <JobPicker
        selectedJobId={selectedJobId}
        onSelect={(job) => {
          setSelectedJobId(job.id)
        }}
      />

      {selectedJob ? <FitPanel key={selectedJob.id} job={selectedJob} resume={resume} /> : null}
    </main>
  )
}
