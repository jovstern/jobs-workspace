import type { LearningPlan, Rating } from '@jobs-workspace/shared'
import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { GapsSection } from './GapsSection'
import type { GapEntry } from './selectors'

const NO_GAPS_LINE = 'Every requirement is evidenced in your resume.'

function plan(requirementId: string, overrides: Partial<LearningPlan> = {}): LearningPlan {
  return {
    requirementId,
    steps: [`First step for ${requirementId}`, `Second step for ${requirementId}`],
    whyItMatters: `Why ${requirementId} matters.`,
    effort: 'weeks',
    ...overrides,
  }
}

function gap(
  id: string,
  kind: 'required' | 'nice_to_have',
  rating: Exclude<Rating, 'met'>,
  extra: Partial<GapEntry> = {},
): GapEntry {
  return {
    requirement: { id, kind, skill: 'React', text: `Requirement ${id}` },
    rating,
    quote: rating === 'partial' ? `Quote for ${id}` : null,
    rationale: '',
    quoteRejected: false,
    plan: plan(id),
    ...extra,
  }
}

// The label is bold, so the sentence is split across two nodes: match on the paragraph's text.
function effortLine(effort: string) {
  return screen.getByText(
    (_content, element) =>
      element?.tagName === 'P' && element.textContent === `Rough effort: ${effort}`,
  )
}

function renderGaps(
  required: GapEntry[],
  niceToHave: GapEntry[] = [],
  hasAdvice = true,
  notice?: React.ReactNode,
) {
  return render(
    <GapsSection gaps={{ required, niceToHave }} hasAdvice={hasAdvice} notice={notice} />,
  )
}

test('the section has a Gaps heading and two groups headed with their counts', () => {
  renderGaps(
    [gap('r1', 'required', 'not_evidenced'), gap('r2', 'required', 'partial')],
    [gap('n1', 'nice_to_have', 'not_evidenced')],
  )

  expect(screen.getByRole('heading', { level: 3, name: 'Gaps' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 4, name: 'Required gaps (2)' })).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { level: 4, name: 'Nice-to-have gaps (1)' }),
  ).toBeInTheDocument()
  const required = screen.getByRole('list', { name: 'Required gaps (2)' })
  const nice = screen.getByRole('list', { name: 'Nice-to-have gaps (1)' })
  expect(Array.from(required.children)).toHaveLength(2)
  expect(within(nice).getByText('Requirement n1')).toBeInTheDocument()
})

test('the number in each heading equals the number of gap items under it', () => {
  renderGaps(
    [
      gap('r1', 'required', 'not_evidenced'),
      gap('r2', 'required', 'not_evidenced'),
      gap('r3', 'required', 'partial'),
    ],
    [gap('n1', 'nice_to_have', 'not_evidenced'), gap('n2', 'nice_to_have', 'partial')],
  )

  expect(screen.getByRole('list', { name: 'Required gaps (3)' })).toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'Nice-to-have gaps (2)' })).toBeInTheDocument()
  const requiredList = screen.getByRole('list', { name: 'Required gaps (3)' })
  expect(Array.from(requiredList.children)).toHaveLength(3)
  const niceList = screen.getByRole('list', { name: 'Nice-to-have gaps (2)' })
  expect(Array.from(niceList.children)).toHaveLength(2)
})

test('a group with no gaps is not rendered, and one gap uses the same item as many', () => {
  renderGaps([gap('r1', 'required', 'not_evidenced')], [])

  expect(screen.getByRole('heading', { level: 4, name: 'Required gaps (1)' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /Nice-to-have gaps/ })).not.toBeInTheDocument()
  expect(screen.queryByText(NO_GAPS_LINE)).not.toBeInTheDocument()
})

test('gaps keep the order they are given in', () => {
  renderGaps([
    gap('r3', 'required', 'not_evidenced'),
    gap('r1', 'required', 'not_evidenced'),
    gap('r2', 'required', 'not_evidenced'),
  ])

  const items = Array.from(screen.getByRole('list', { name: 'Required gaps (3)' }).children)
  expect(items.map((item) => item.textContent)).toEqual([
    expect.stringContaining('Requirement r3'),
    expect.stringContaining('Requirement r1'),
    expect.stringContaining('Requirement r2'),
  ])
})

test('with no gaps at all one line shows and there is no group heading', () => {
  renderGaps([], [])

  expect(screen.getByRole('heading', { level: 3, name: 'Gaps' })).toBeInTheDocument()
  expect(screen.getByText(NO_GAPS_LINE)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 4 })).not.toBeInTheDocument()
})

test('the Gaps heading can take focus programmatically', () => {
  renderGaps([])

  expect(screen.getByRole('heading', { level: 3, name: 'Gaps' })).toHaveAttribute('tabindex', '-1')
})

test('each gap shows its requirement and the exact phrase for its rating', () => {
  renderGaps([gap('r1', 'required', 'not_evidenced'), gap('r2', 'required', 'partial')])

  const [first, second] = Array.from(
    screen.getByRole('list', { name: 'Required gaps (2)' }).children,
  )
  expect(first).toHaveTextContent('Requirement r1')
  expect(first).toHaveTextContent('not evidenced in your resume')
  expect(first).not.toHaveTextContent('partly evidenced')
  expect(second).toHaveTextContent('Requirement r2')
  expect(second).toHaveTextContent('partly evidenced in your resume')
})

test('a partial gap shows its stored quote and a not evidenced gap shows none', () => {
  renderGaps([gap('r1', 'required', 'not_evidenced'), gap('r2', 'required', 'partial')])

  const [first, second] = Array.from(
    screen.getByRole('list', { name: 'Required gaps (2)' }).children,
  )
  if (first === undefined || second === undefined) throw new Error('expected two gap items')
  expect(second).toHaveTextContent('From your resume:')
  expect(within(second as HTMLElement).getByRole('blockquote')).toHaveTextContent('Quote for r2')
  expect(first).not.toHaveTextContent('From your resume:')
  expect(within(first as HTMLElement).queryByRole('blockquote')).not.toBeInTheDocument()
})

test('a partial gap with no stored quote shows no quote label', () => {
  renderGaps([gap('r1', 'required', 'partial', { quote: null })])

  expect(screen.queryByText('From your resume:')).not.toBeInTheDocument()
  expect(screen.queryByRole('blockquote')).not.toBeInTheDocument()
})

test('a required gap shows its plan open: steps in order, why it matters and the effort', () => {
  renderGaps([
    gap('r1', 'required', 'not_evidenced', {
      plan: plan('r1', { steps: ['Third', 'First', 'Second'], effort: 'weeks' }),
    }),
  ])

  expect(screen.getByText('What to learn')).toBeInTheDocument()
  const steps = screen.getByRole('list', { name: 'What to learn' })
  expect(
    within(steps)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['Third', 'First', 'Second'])
  expect(screen.getByText('Why it matters for this job')).toBeInTheDocument()
  expect(screen.getByText('Why r1 matters.')).toBeInTheDocument()
  expect(effortLine('weeks')).toBeInTheDocument()
})

test('a plan with a single step is still a numbered list of one', () => {
  renderGaps([gap('r1', 'required', 'not_evidenced', { plan: plan('r1', { steps: ['Only'] }) })])

  const steps = screen.getByRole('list', { name: 'What to learn' })
  expect(steps.tagName).toBe('OL')
  expect(within(steps).getAllByRole('listitem')).toHaveLength(1)
})

test('the effort word follows the plan: days, weeks or months', () => {
  renderGaps([
    gap('r1', 'required', 'not_evidenced', { plan: plan('r1', { effort: 'days' }) }),
    gap('r2', 'required', 'not_evidenced', { plan: plan('r2', { effort: 'months' }) }),
  ])

  expect(effortLine('days')).toBeInTheDocument()
  expect(effortLine('months')).toBeInTheDocument()
})

test('a gap is never worded as a failure and never uses the danger tone', () => {
  const { container } = renderGaps(
    [gap('r1', 'required', 'not_evidenced'), gap('r2', 'required', 'partial')],
    [gap('n1', 'nice_to_have', 'not_evidenced')],
  )

  expect(container.innerHTML).not.toMatch(/red-/)
})

test('the notice slot renders directly under the Gaps heading', () => {
  renderGaps([gap('r1', 'required', 'not_evidenced')], [], false, <p>The old result notice</p>)

  const heading = screen.getByRole('heading', { level: 3, name: 'Gaps' })
  const notice = screen.getByText('The old result notice')
  const group = screen.getByRole('heading', { level: 4, name: 'Required gaps (1)' })
  expect(heading.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(notice.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
