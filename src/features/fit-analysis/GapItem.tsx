import { Collapsible } from 'radix-ui'
import { useState } from 'react'

import { Button } from '../../components/Button'
import { LearningPlanBlock } from './LearningPlanBlock'
import type { GapEntry } from './selectors'

interface GapItemProps {
  entry: GapEntry
  // Nice-to-have plans start closed; required plans are always open.
  collapsible: boolean
  // False for a result saved before learning plans existed: no plan area at all.
  hasAdvice: boolean
}

const MISSING_PLAN = 'No learning plan was generated for this one. Check again to try once more.'

// Everything from the model (quote, plan text) is rendered as plain text, never as markup.
export function GapItem({ entry, collapsible, hasAdvice }: GapItemProps) {
  const [open, setOpen] = useState(false)
  const isPartial = entry.rating === 'partial'
  const { plan } = entry
  const triggerLabel = open ? 'Hide plan' : 'Show plan'

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
      {!hasAdvice ? null : plan === null ? (
        <p className="text-sm text-gray-600">{MISSING_PLAN}</p>
      ) : collapsible ? (
        <Collapsible.Root open={open} onOpenChange={setOpen} className="flex flex-col gap-2">
          <Collapsible.Trigger asChild>
            <Button
              variant="link"
              className="min-h-6 self-start"
              aria-label={`${triggerLabel}: ${entry.requirement.text}`}
            >
              {triggerLabel}
            </Button>
          </Collapsible.Trigger>
          <Collapsible.Content>
            <LearningPlanBlock plan={plan} partial={isPartial} />
          </Collapsible.Content>
        </Collapsible.Root>
      ) : (
        <LearningPlanBlock plan={plan} partial={isPartial} />
      )}
    </li>
  )
}
