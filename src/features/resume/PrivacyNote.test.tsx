import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { PrivacyNote } from './PrivacyNote'

// The approved wording (01-UI-SPEC, "Privacy note"). Each paragraph is matched as a full string so
// a shortened caveat fails the test.
const SERVER_PARAGRAPH =
  "This app's server reads your resume only to pull the text out of a PDF and to pass it to Google's Gemini AI. It does not store or log your resume."
const SENDING_PARAGRAPH =
  "To analyse it, the app sends your resume text to Google's Gemini AI, with email addresses, phone numbers, street addresses and links removed where we can recognise them. Google processes the text to produce the analysis."
const PAID_TIER_PARAGRAPH =
  "On Google's paid tier, Google says it does not use this content to improve its products. It keeps logs of requests for a limited time, only to detect abuse and meet legal obligations."
const BROWSER_PARAGRAPH = 'Your resume, profile and fit checks are saved only in this browser.'

function paragraphs(container: HTMLElement) {
  return Array.from(container.querySelectorAll('p')).map((paragraph) => paragraph.textContent)
}

test('has the level-2 heading How your resume is used', () => {
  render(<PrivacyNote paidTierConfirmed />)

  expect(
    screen.getByRole('heading', { level: 2, name: 'How your resume is used' }),
  ).toBeInTheDocument()
})

test('with the paid tier confirmed shows the four paragraphs in order, word for word', () => {
  const { container } = render(<PrivacyNote paidTierConfirmed />)

  expect(paragraphs(container)).toEqual([
    SERVER_PARAGRAPH,
    SENDING_PARAGRAPH,
    PAID_TIER_PARAGRAPH,
    BROWSER_PARAGRAPH,
  ])
})

test('without the paid tier confirmed leaves out that paragraph and changes nothing else', () => {
  const { container } = render(<PrivacyNote paidTierConfirmed={false} />)

  expect(paragraphs(container)).toEqual([SERVER_PARAGRAPH, SENDING_PARAGRAPH, BROWSER_PARAGRAPH])
  expect(container).not.toHaveTextContent(/paid tier/i)
})

test('rendered with no prop follows the recorded billing decision (billing confirmed)', () => {
  const { container } = render(<PrivacyNote />)

  expect(paragraphs(container)).toEqual([
    SERVER_PARAGRAPH,
    SENDING_PARAGRAPH,
    PAID_TIER_PARAGRAPH,
    BROWSER_PARAGRAPH,
  ])
})
