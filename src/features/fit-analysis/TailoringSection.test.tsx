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

const UNAVAILABLE =
  'Tailoring tips could not be generated for this check. Check again to try once more.'
const NO_TIPS = 'Nothing specific to emphasise for this job.'
const NO_KEYWORDS = 'No missing keywords found.'
const SUB_EMPHASISE = 'Emphasise what you already have'
const SUB_KEYWORDS = 'Words from the posting your resume does not use'

function tips(count: number): Tailoring['emphasise'] {
  return Array.from({ length: count }, (_, index) => ({
    quote: `Quote number ${String(index + 1)}`,
    advice: `Advice number ${String(index + 1)}`,
  }))
}

function words(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Keyword${String(index + 1)}`)
}

test('tailoring that could not be generated shows only the heading and one line', () => {
  const { container } = renderSection(null)

  expect(
    screen.getByRole('heading', { level: 3, name: 'Tailoring your resume for this job' }),
  ).toBeInTheDocument()
  expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument()
  expect(screen.queryByText(INTRO)).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 4 })).not.toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
  expect(screen.queryByText(NOTE)).not.toBeInTheDocument()
  expect(container.querySelectorAll('p')).toHaveLength(1)
})

test('with no tips and no keywords both sub-sections say so and the note is absent', () => {
  renderSection({ emphasise: [], keywords: [] })

  expect(screen.getByText(INTRO)).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 4, name: SUB_EMPHASISE })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 4, name: SUB_KEYWORDS })).toBeInTheDocument()
  expect(screen.getByText(NO_TIPS)).toBeInTheDocument()
  expect(screen.getByText(NO_KEYWORDS)).toBeInTheDocument()
  expect(screen.queryByText(NOTE)).not.toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

test('tips with no keywords show the tips, then the empty keyword line and no note', () => {
  renderSection({ emphasise: tips(2), keywords: [] })

  expect(
    within(screen.getByRole('list', { name: SUB_EMPHASISE })).getAllByRole('listitem'),
  ).toHaveLength(2)
  expect(screen.queryByText(NO_TIPS)).not.toBeInTheDocument()
  expect(screen.getByText(NO_KEYWORDS)).toBeInTheDocument()
  expect(screen.queryByText(NOTE)).not.toBeInTheDocument()
  expect(screen.queryByRole('list', { name: SUB_KEYWORDS })).not.toBeInTheDocument()
})

test('keywords with no tips show the empty tips line, then the note and the chips', () => {
  renderSection({ emphasise: [], keywords: words(3) })

  expect(screen.getByText(NO_TIPS)).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: SUB_EMPHASISE })).not.toBeInTheDocument()
  expect(screen.queryByText(NO_KEYWORDS)).not.toBeInTheDocument()
  const note = screen.getByText(NOTE)
  const list = screen.getByRole('list', { name: SUB_KEYWORDS })
  expect(within(list).getAllByRole('listitem')).toHaveLength(3)
  expect(note.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test.each([1, 5])('%i tip(s) use the same item: label, quote, then advice', (count) => {
  renderSection({ emphasise: tips(count), keywords: [] })

  const items = within(screen.getByRole('list', { name: SUB_EMPHASISE })).getAllByRole('listitem')
  expect(items).toHaveLength(count)
  for (const item of items) {
    expect(within(item).getAllByText('From your resume:')).toHaveLength(1)
    expect(within(item).getAllByRole('blockquote')).toHaveLength(1)
    expect(Array.from(item.children).map((child) => child.tagName)).toEqual([
      'P',
      'BLOCKQUOTE',
      'P',
    ])
  }
})

test.each([1, 8])('%i keyword(s) are all shown, with no show-more control', (count) => {
  renderSection({ emphasise: [], keywords: words(count) })

  const list = screen.getByRole('list', { name: SUB_KEYWORDS })
  expect(within(list).getAllByRole('listitem')).toHaveLength(count)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByText(/show more/i)).not.toBeInTheDocument()
})

test('the section contains no button and no link in any state', () => {
  for (const tailoring of [null, { emphasise: [], keywords: [] }, TWO_TIPS_THREE_KEYWORDS]) {
    const { unmount } = renderSection(tailoring)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    unmount()
  }
})

test('a chip is not focusable and has no button or link role', () => {
  renderSection({ emphasise: [], keywords: ['Python'] })

  const chip = screen.getByText('Python')
  expect(chip.tagName).toBe('SPAN')
  expect(chip).not.toHaveAttribute('tabindex')
  expect(chip).not.toHaveAttribute('role')
  expect(chip).not.toHaveAttribute('href')
  expect(chip.onclick).toBeNull()
  const list = screen.getByRole('list', { name: SUB_KEYWORDS })
  expect(list.querySelector('a, button, [tabindex], [role="button"], [role="link"]')).toBeNull()
})

test('a quote, an advice text and a keyword that look like HTML are shown as literal text', () => {
  const quote = '<b>bold quote</b>'
  const advice = '<img src="x" onerror="alert(1)">'
  const keyword = '<a href="https://example.com">link</a>'
  const { container } = renderSection({ emphasise: [{ quote, advice }], keywords: [keyword] })

  expect(screen.getByRole('blockquote').textContent).toBe(quote)
  expect(screen.getByText(advice)).toBeInTheDocument()
  expect(screen.getByText(keyword)).toBeInTheDocument()
  expect(container.querySelector('img, a, button, b, script')).toBeNull()
})

test('a 40-character keyword sits in a chip that wraps its text', () => {
  const long = 'Infrastructure-as-code-orchestration-xyz'
  expect(long).toHaveLength(40)
  renderSection({ emphasise: [], keywords: [long] })

  expect(screen.getByText(long)).toHaveClass('break-words')
})

test('five tips put no cap on height, lines or scrolling', () => {
  const { container } = renderSection({ emphasise: tips(5), keywords: words(8) })

  for (let number = 1; number <= 5; number += 1) {
    expect(screen.getByText(`Advice number ${String(number)}`)).toBeInTheDocument()
  }
  expect(container.innerHTML).not.toMatch(
    /truncate|line-clamp|overflow-|max-h-|\bh-\d|text-ellipsis|whitespace-nowrap/,
  )
})

test('stored tips and keywords are shown in the stored sequence, repeats included', () => {
  renderSection({
    emphasise: [
      { quote: 'Zed', advice: 'Last in the alphabet, first here.' },
      { quote: 'Alpha', advice: 'First in the alphabet, second here.' },
    ],
    keywords: ['Zulu', 'Alpha', 'Zulu'],
  })

  const quotes = screen.getAllByRole('blockquote').map((quote) => quote.textContent)
  expect(quotes).toEqual(['Zed', 'Alpha'])
  const chips = within(screen.getByRole('list', { name: SUB_KEYWORDS }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)
  expect(chips).toEqual(['Zulu', 'Alpha', 'Zulu'])
})

test('the intro is always the first thing under the heading when tailoring is present', () => {
  const { container } = renderSection(TWO_TIPS_THREE_KEYWORDS)

  const heading = screen.getByRole('heading', { level: 3 })
  expect(heading.nextElementSibling).toBe(screen.getByText(INTRO))
  expect(container.querySelectorAll('blockquote')).toHaveLength(2)
})
