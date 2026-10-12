import type { Tailoring } from '@jobs-workspace/shared'
import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { TailoringSection } from './TailoringSection'

const INTRO =
  'These tips only point at text that is already in your resume. Never add something that is not true.'
const NOTE = 'Add only if true for you.'

const TWO_TIPS_THREE_KEYWORDS: Tailoring = {
  emphasise: [
    { quote: 'Led a team of five engineers', advice: 'Put team leadership near the top.' },
    { quote: 'Built a design system in React', advice: 'Name the design system in your summary.' },
  ],
  keywords: ['Python', 'SQL', 'Statistics'],
}

function renderSection(tailoring: Tailoring | null) {
  return render(<TailoringSection tailoring={tailoring} />)
}

test('the section has its heading and the fixed intro before anything else', () => {
  renderSection(TWO_TIPS_THREE_KEYWORDS)

  const heading = screen.getByRole('heading', {
    level: 3,
    name: 'Tailoring your resume for this job',
  })
  const intro = screen.getByText(INTRO)
  const firstSub = screen.getByRole('heading', {
    level: 4,
    name: 'Emphasise what you already have',
  })
  expect(heading.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(intro.compareDocumentPosition(firstSub) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('each tip shows its label, then the stored quote in a blockquote, then the advice', () => {
  renderSection(TWO_TIPS_THREE_KEYWORDS)

  const list = screen.getByRole('list', { name: 'Emphasise what you already have' })
  const items = within(list).getAllByRole('listitem')
  expect(items).toHaveLength(2)

  const [first, second] = items
  if (first === undefined || second === undefined) throw new Error('expected two tips')
  expect(first).toHaveTextContent('From your resume:')
  const quote = within(first).getByRole('blockquote')
  expect(quote.textContent).toBe('Led a team of five engineers')
  expect(first).toHaveTextContent('Put team leadership near the top.')
  expect(second).toHaveTextContent('From your resume:')
  expect(within(second).getByRole('blockquote').textContent).toBe('Built a design system in React')

  const label = within(first).getByText('From your resume:')
  const advice = within(first).getByText('Put team leadership near the top.')
  expect(label.compareDocumentPosition(quote) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(quote.compareDocumentPosition(advice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('keywords are chips in a list under the note, which sits under the sub-heading', () => {
  renderSection(TWO_TIPS_THREE_KEYWORDS)

  const heading = screen.getByRole('heading', {
    level: 4,
    name: 'Words from the posting your resume does not use',
  })
  const note = screen.getByText(NOTE)
  const list = screen.getByRole('list', { name: 'Words from the posting your resume does not use' })
  expect(
    within(list)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['Python', 'SQL', 'Statistics'])
  expect(heading.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(note.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
