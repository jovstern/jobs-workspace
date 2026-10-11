import { useId } from 'react'

// Decision recorded 2026-10-11 (plan 01-11, Task 1): option `billing-confirmed`. The user confirmed
// that the Google project behind GEMINI_API_KEY has an active billing account, so the paid-tier
// paragraph ships. If billing on that project ever lapses, set this to false: the paragraph is
// then dropped and nothing else in the note changes (UI-SPEC "Privacy note", rule 2).
const PAID_TIER_CONFIRMED = true

// Fixed copy from the approved UI-SPEC. Do not rephrase, shorten or reorder; the caveats ("where
// we can recognise them", "Google says", "limited time", "only to detect abuse and meet legal
// obligations") are part of what is promised.
const SERVER_PARAGRAPH =
  "This app's server reads your resume only to pull the text out of a PDF and to pass it to Google's Gemini AI. It does not store or log your resume."
const SENDING_PARAGRAPH =
  "To analyse it, the app sends your resume text to Google's Gemini AI, with email addresses, phone numbers, street addresses and links removed where we can recognise them. Google processes the text to produce the analysis."
const PAID_TIER_PARAGRAPH =
  "On Google's paid tier, Google says it does not use this content to improve its products. It keeps logs of requests for a limited time, only to detect abuse and meet legal obligations."
const BROWSER_PARAGRAPH = 'Your resume, profile and fit checks are saved only in this browser.'

interface PrivacyNoteProps {
  paidTierConfirmed?: boolean
}

// Always shown in full, never collapsed. Plain text only: no accent colour.
export function PrivacyNote({ paidTierConfirmed = PAID_TIER_CONFIRMED }: PrivacyNoteProps) {
  const headingId = useId()

  return (
    <div aria-labelledby={headingId} role="group" className="flex flex-col gap-2">
      <h2 id={headingId} className="text-xl leading-[1.2] font-semibold text-gray-900">
        How your resume is used
      </h2>
      <p className="text-base break-words text-gray-900">{SERVER_PARAGRAPH}</p>
      <p className="text-base break-words text-gray-900">{SENDING_PARAGRAPH}</p>
      {paidTierConfirmed ? (
        <p className="text-base break-words text-gray-900">{PAID_TIER_PARAGRAPH}</p>
      ) : null}
      <p className="text-base break-words text-gray-900">{BROWSER_PARAGRAPH}</p>
    </div>
  )
}
