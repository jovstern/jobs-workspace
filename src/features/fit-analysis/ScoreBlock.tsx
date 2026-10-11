import type { Band } from '@jobs-workspace/shared'

import { Badge } from '../../components/Badge'
import type { BadgeTone } from '../../components/Badge'

interface ScoreBlockProps {
  score: number
  band: Band
  requiredMet: number
  requiredTotal: number
  analysedAt: string
}

// Neutral and caution for the low end on purpose: the score is a guide, never a verdict.
const BAND_TONES: Record<Band, BadgeTone> = {
  'Strong fit': 'success',
  'Good fit': 'teal',
  Stretch: 'caution',
  'Long shot': 'neutral',
}

const DISCLAIMER =
  'This is an estimate of how your resume matches the requirements in this posting. It is a guide to where to focus, not a verdict on whether to apply.'

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function ScoreBlock({
  score,
  band,
  requiredMet,
  requiredTotal,
  analysedAt,
}: ScoreBlockProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-gray-600">Fit estimate</p>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-3xl leading-[1.2] font-semibold text-gray-900 tabular-nums">
          {score}%
        </span>
        <Badge tone={BAND_TONES[band]}>{band}</Badge>
      </div>
      <p className="text-base text-gray-900">
        {requiredMet} of {requiredTotal} required requirements met
      </p>
      <p className="text-sm break-words text-gray-600">{DISCLAIMER}</p>
      <p className="text-sm text-gray-600">
        Checked {DATE_FORMAT.format(new Date(analysedAt))}. Saved in this browser.
      </p>
    </div>
  )
}
