import type { Job } from '@jobs-workspace/shared'

import { useIsCheckingFit } from '../fit-analysis/mutations'

interface JobRowProps {
  job: Job
  selected: boolean
  onSelect: (job: Job) => void
}

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700'

// One job in the list. It lives in its own file because each row asks whether its own fit check is
// running, and a hook cannot be called inside a loop.
export function JobRow({ job, selected, onSelect }: JobRowProps) {
  const isChecking = useIsCheckingFit(job.id)
  const tone = selected
    ? 'border-gray-200 border-l-blue-700 bg-blue-50'
    : 'border-gray-200 border-l-transparent hover:bg-gray-50'

  return (
    <button
      type="button"
      aria-current={selected ? 'true' : undefined}
      onClick={() => {
        onSelect(job)
      }}
      className={`block w-full rounded border border-l-4 px-4 py-2 text-left ${tone} ${FOCUS}`}
    >
      <span className="block text-base font-semibold break-words text-gray-900">{job.title}</span>
      <span className="block text-sm break-words text-gray-600">
        {job.company} · {job.level} · {job.location}
      </span>
      {isChecking ? <span className="block text-sm text-gray-600">Checking fit</span> : null}
    </button>
  )
}
