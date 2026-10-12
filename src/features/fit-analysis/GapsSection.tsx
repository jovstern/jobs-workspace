import { useId } from 'react'
import type { ReactNode } from 'react'

import { GapItem } from './GapItem'
import type { GapEntry } from './selectors'

interface GapsSectionProps {
  gaps: { required: GapEntry[]; niceToHave: GapEntry[] }
  hasAdvice: boolean
  // Shown directly under the heading, before the lists (the old-result notice).
  notice?: ReactNode
}

interface GapGroupProps {
  label: string
  entries: GapEntry[]
  collapsible: boolean
  hasAdvice: boolean
}

function GapGroup({ label, entries, collapsible, hasAdvice }: GapGroupProps) {
  const labelId = useId()
  if (entries.length === 0) return null

  return (
    <div className="mt-4">
      <h4 id={labelId} className="text-base font-semibold text-gray-900">
        {label} ({entries.length})
      </h4>
      <ol aria-labelledby={labelId} className="mt-2 flex flex-col gap-6">
        {entries.map((entry) => (
          <GapItem
            key={entry.requirement.id}
            entry={entry}
            collapsible={collapsible}
            hasAdvice={hasAdvice}
          />
        ))}
      </ol>
    </div>
  )
}

export function GapsSection({ gaps, hasAdvice, notice }: GapsSectionProps) {
  const noGaps = gaps.required.length === 0 && gaps.niceToHave.length === 0

  return (
    <div>
      <h3 tabIndex={-1} className="text-base font-semibold text-gray-900">
        Gaps
      </h3>
      {notice}
      {noGaps ? (
        <p className="mt-2 text-base text-gray-900">
          Every requirement is evidenced in your resume.
        </p>
      ) : (
        <>
          <GapGroup
            label="Required gaps"
            entries={gaps.required}
            collapsible={false}
            hasAdvice={hasAdvice}
          />
          <GapGroup
            label="Nice-to-have gaps"
            entries={gaps.niceToHave}
            collapsible
            hasAdvice={hasAdvice}
          />
        </>
      )}
    </div>
  )
}
