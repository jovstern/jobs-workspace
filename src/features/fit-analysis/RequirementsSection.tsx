import type { Rating } from '@jobs-workspace/shared'
import { useId } from 'react'

import { Badge } from '../../components/Badge'
import type { BadgeTone } from '../../components/Badge'
import type { RatedItem } from './selectors'

interface RequirementsSectionProps {
  required: RatedItem[]
  niceToHave: RatedItem[]
}

const RATING_LABELS: Record<Rating, string> = {
  met: 'Met',
  partial: 'Partial',
  not_evidenced: 'Not evidenced',
}

const RATING_GLYPHS: Record<Rating, string> = {
  met: '✓',
  partial: '◐',
  not_evidenced: '○',
}

const RATING_TONES: Record<Rating, BadgeTone> = {
  met: 'success',
  partial: 'caution',
  not_evidenced: 'neutral',
}

const REJECTED_QUOTE =
  'The AI cited text we could not find in your resume, so this was marked not evidenced.'

interface GroupProps {
  label: string
  items: RatedItem[]
}

// Everything from the model (quote, rationale) is rendered as plain text, never as markup.
function RequirementGroup({ label, items }: GroupProps) {
  const labelId = useId()
  if (items.length === 0) return null

  return (
    <div className="mt-4">
      <h4 id={labelId} className="text-base font-semibold text-gray-900">
        {label}
      </h4>
      <ol aria-labelledby={labelId} className="mt-2 flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.requirement.id} className="flex min-w-0 flex-col gap-2">
            <p className="text-base break-words text-gray-900">{item.requirement.text}</p>
            <div>
              <Badge tone={RATING_TONES[item.rating]}>
                <span aria-hidden="true">{RATING_GLYPHS[item.rating]}</span>
                <span>{RATING_LABELS[item.rating]}</span>
              </Badge>
            </div>
            {item.rating !== 'not_evidenced' && item.quote !== null ? (
              <>
                <p className="text-sm text-gray-600">From your resume:</p>
                <blockquote className="border-l-2 border-gray-300 pl-4 text-sm break-words text-gray-900">
                  {item.quote}
                </blockquote>
              </>
            ) : null}
            {item.quoteRejected ? (
              <p className="text-sm break-words text-gray-600">{REJECTED_QUOTE}</p>
            ) : null}
            {item.rationale !== '' ? (
              <p className="text-sm break-words text-gray-600">{item.rationale}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function RequirementsSection({ required, niceToHave }: RequirementsSectionProps) {
  return (
    <div>
      <h3 tabIndex={-1} className="text-base font-semibold text-gray-900">
        Requirements
      </h3>
      <RequirementGroup label="Required" items={required} />
      <RequirementGroup label="Nice to have" items={niceToHave} />
    </div>
  )
}
