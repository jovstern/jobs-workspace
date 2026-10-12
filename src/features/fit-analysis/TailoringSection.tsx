import type { Tailoring } from '@jobs-workspace/shared'
import { useId } from 'react'

import { Chip } from '../../components/Chip'

interface TailoringSectionProps {
  tailoring: Tailoring | null
}

const INTRO =
  'These tips only point at text that is already in your resume. Never add something that is not true.'
const UNAVAILABLE =
  'Tailoring tips could not be generated for this check. Check again to try once more.'
const NO_TIPS = 'Nothing specific to emphasise for this job.'
const NO_KEYWORDS = 'No missing keywords found.'
const KEYWORD_NOTE = 'Add only if true for you.'

// Everything from the model (quote, advice, keyword) is rendered as plain text, never as markup.
// The server has already checked every quote against the resume and filtered every keyword; the page
// shows exactly what is stored and does no matching, sorting or filtering of its own.
export function TailoringSection({ tailoring }: TailoringSectionProps) {
  const emphasiseId = useId()
  const keywordsId = useId()

  return (
    <div>
      <h3 tabIndex={-1} className="text-base font-semibold text-gray-900">
        Tailoring your resume for this job
      </h3>
      {tailoring === null ? (
        <p className="mt-2 text-sm text-gray-600">{UNAVAILABLE}</p>
      ) : (
        <>
          <p className="mt-2 text-base text-gray-900">{INTRO}</p>

          <h4 id={emphasiseId} className="mt-4 text-base font-semibold text-gray-900">
            Emphasise what you already have
          </h4>
          {tailoring.emphasise.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">{NO_TIPS}</p>
          ) : (
            <ul aria-labelledby={emphasiseId} className="mt-2 flex flex-col gap-6">
              {tailoring.emphasise.map((tip, index) => (
                <li
                  key={`${String(index)}-${tip.quote}-${tip.advice}`}
                  className="flex min-w-0 flex-col gap-2"
                >
                  <p className="text-sm text-gray-600">From your resume:</p>
                  <blockquote className="border-l-2 border-gray-300 pl-4 text-sm break-words text-gray-900">
                    {tip.quote}
                  </blockquote>
                  <p className="text-base break-words text-gray-900">{tip.advice}</p>
                </li>
              ))}
            </ul>
          )}

          <h4 id={keywordsId} className="mt-4 text-base font-semibold text-gray-900">
            Words from the posting your resume does not use
          </h4>
          {tailoring.keywords.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">{NO_KEYWORDS}</p>
          ) : (
            <>
              <p className="text-sm text-gray-600">{KEYWORD_NOTE}</p>
              <ul aria-labelledby={keywordsId} className="mt-2 flex flex-wrap gap-2">
                {tailoring.keywords.map((keyword, index) => (
                  <li key={`${String(index)}-${keyword}`} className="min-w-0">
                    <Chip>{keyword}</Chip>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
