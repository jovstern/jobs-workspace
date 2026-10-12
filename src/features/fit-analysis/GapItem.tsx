import { LearningPlanBlock } from './LearningPlanBlock'
import type { GapEntry } from './selectors'

interface GapItemProps {
  entry: GapEntry
  // Nice-to-have plans start closed; required plans are always open. Added with the collapsible.
  collapsible: boolean
  // False for a result saved before learning plans existed: no plan area at all.
  hasAdvice: boolean
}

// Everything from the model (quote, plan text) is rendered as plain text, never as markup.
export function GapItem({ entry, hasAdvice }: GapItemProps) {
  const isPartial = entry.rating === 'partial'

  return (
    <li className="flex min-w-0 flex-col gap-2">
      <p className="text-base break-words text-gray-900">{entry.requirement.text}</p>
      <p className="flex items-baseline gap-2">
        <span aria-hidden="true" className="text-gray-600">
          {isPartial ? '◐' : '○'}
        </span>
        <span className="text-sm font-semibold text-gray-900">
          {isPartial ? 'partly evidenced in your resume' : 'not evidenced in your resume'}
        </span>
      </p>
      {isPartial && entry.quote !== null ? (
        <>
          <p className="text-sm text-gray-600">From your resume:</p>
          <blockquote className="border-l-2 border-gray-300 pl-4 text-sm break-words text-gray-900">
            {entry.quote}
          </blockquote>
        </>
      ) : null}
      {hasAdvice && entry.plan !== null ? (
        <LearningPlanBlock plan={entry.plan} partial={isPartial} />
      ) : null}
    </li>
  )
}
