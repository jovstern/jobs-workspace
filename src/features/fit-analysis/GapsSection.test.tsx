import type { LearningPlan, Rating } from '@jobs-workspace/shared'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const MISSING_PLAN_LINE =
  'No learning plan was generated for this one. Check again to try once more.'
const PARTIAL_LEAD_IN = 'This plan covers only what your resume does not yet show.'

test('a nice-to-have plan starts closed behind a Show plan button', () => {
  renderGaps([], [gap('n1', 'nice_to_have', 'not_evidenced')])

  const trigger = screen.getByRole('button', { name: 'Show plan: Requirement n1' })
  expect(trigger).toHaveTextContent('Show plan')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('What to learn')).not.toBeInTheDocument()
  expect(screen.queryByText('Why it matters for this job')).not.toBeInTheDocument()
})

test('opening a nice-to-have plan shows it, and the button then reads Hide plan', async () => {
  const user = userEvent.setup()
  renderGaps([], [gap('n1', 'nice_to_have', 'not_evidenced')])

  await user.click(screen.getByRole('button', { name: 'Show plan: Requirement n1' }))

  const trigger = screen.getByRole('button', { name: 'Hide plan: Requirement n1' })
  expect(trigger).toHaveTextContent('Hide plan')
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('list', { name: 'What to learn' })).toBeInTheDocument()
  expect(screen.getByText('Why n1 matters.')).toBeInTheDocument()

  await user.click(trigger)

  expect(screen.queryByText('What to learn')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Show plan: Requirement n1' })).toBeInTheDocument()
})

test('two Show plan buttons have different accessible names', () => {
  renderGaps([], [gap('n1', 'nice_to_have', 'not_evidenced'), gap('n2', 'nice_to_have', 'partial')])

  const names = screen
    .getAllByRole('button', { name: /^Show plan:/ })
    .map((button) => button.getAttribute('aria-label'))
  expect(names).toEqual(['Show plan: Requirement n1', 'Show plan: Requirement n2'])
})

test('a required plan has no Show plan button', () => {
  renderGaps([gap('r1', 'required', 'not_evidenced')])

  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByText('What to learn')).toBeInTheDocument()
})

test('a partial gap leads its plan with what the plan covers; a not evidenced gap does not', () => {
  renderGaps([gap('r1', 'required', 'partial'), gap('r2', 'required', 'not_evidenced')])

  expect(screen.getAllByText(PARTIAL_LEAD_IN)).toHaveLength(1)
  const [first, second] = Array.from(
    screen.getByRole('list', { name: 'Required gaps (2)' }).children,
  )
  expect(first).toHaveTextContent(PARTIAL_LEAD_IN)
  expect(second).not.toHaveTextContent(PARTIAL_LEAD_IN)
})

test('a gap whose plan is missing says so once, with no button', () => {
  renderGaps([
    gap('r1', 'required', 'not_evidenced', { plan: null }),
    gap('r2', 'required', 'partial'),
  ])

  expect(screen.getAllByText(MISSING_PLAN_LINE)).toHaveLength(1)
  const [first, second] = Array.from(
    screen.getByRole('list', { name: 'Required gaps (2)' }).children,
  )
  expect(first).toHaveTextContent(MISSING_PLAN_LINE)
  expect(within(first as HTMLElement).queryByRole('button')).not.toBeInTheDocument()
  expect(second).not.toHaveTextContent(MISSING_PLAN_LINE)
})

test('a nice-to-have gap whose plan is missing shows the line and no Show plan button', () => {
  renderGaps([], [gap('n1', 'nice_to_have', 'not_evidenced', { plan: null })])

  expect(screen.getByText(MISSING_PLAN_LINE)).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('a result without advice shows no plan area, no missing line and no button', () => {
  renderGaps(
    [gap('r1', 'required', 'not_evidenced', { plan: null })],
    [gap('n1', 'nice_to_have', 'partial', { plan: null })],
    false,
  )

  expect(screen.queryByText(MISSING_PLAN_LINE)).not.toBeInTheDocument()
  expect(screen.queryByText('What to learn')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByText('Requirement r1')).toBeInTheDocument()
  expect(screen.getByText('not evidenced in your resume')).toBeInTheDocument()
})

test('plan text and quotes that look like HTML are shown as literal text', async () => {
  const user = userEvent.setup()
  const step = '<b>bold step</b>'
  const why = '<img src="x" onerror="alert(1)">'
  const quote = '<script>alert(2)</script>'
  const { container } = renderGaps(
    [
      gap('r1', 'required', 'partial', {
        quote,
        plan: plan('r1', { steps: [step], whyItMatters: why }),
      }),
    ],
    [gap('n1', 'nice_to_have', 'not_evidenced', { plan: plan('n1', { steps: [step] }) })],
  )
  await user.click(screen.getByRole('button', { name: 'Show plan: Requirement n1' }))

  expect(screen.getAllByText(step).length).toBe(2)
  expect(screen.getByText(why)).toBeInTheDocument()
  expect(screen.getByText(quote)).toBeInTheDocument()
  expect(container.querySelector('b, img, script, a')).toBeNull()
})

test('opening a plan is forgotten when the section is keyed to a new result', async () => {
  const user = userEvent.setup()
  const gaps = { required: [], niceToHave: [gap('n1', 'nice_to_have', 'not_evidenced')] }
  const { rerender } = render(<GapsSection key="first" gaps={gaps} hasAdvice />)
  await user.click(screen.getByRole('button', { name: 'Show plan: Requirement n1' }))
  expect(screen.getByText('What to learn')).toBeInTheDocument()

  rerender(<GapsSection key="second" gaps={gaps} hasAdvice />)

  expect(screen.queryByText('What to learn')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Show plan: Requirement n1' })).toBeInTheDocument()
})

test('eight gaps with four-step plans put no cap on height, lines or scrolling', () => {
  const four = ['One', 'Two', 'Three', 'Four']
  const entries = Array.from({ length: 8 }, (_, index) =>
    gap(`r${String(index + 1)}`, 'required', 'not_evidenced', {
      plan: plan(`r${String(index + 1)}`, { steps: four }),
    }),
  )
  const { container } = renderGaps(entries)

  expect(screen.getAllByText('Four')).toHaveLength(8)
  expect(container.innerHTML).not.toMatch(
    /truncate|line-clamp|overflow-|max-h-|\bh-\d|text-ellipsis/,
  )
})

test('there is no button to claim a skill the resume does not show', () => {
  renderGaps(
    [
      gap('r1', 'required', 'not_evidenced'),
      gap('r2', 'required', 'not_evidenced', { plan: null }),
    ],
    [gap('n1', 'nice_to_have', 'partial')],
  )

  expect(screen.queryByRole('button', { name: /I do have this/i })).not.toBeInTheDocument()
  expect(screen.queryByText(/I do have this/i)).not.toBeInTheDocument()
})
