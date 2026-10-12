import type { Advice, FitResponse, Job, Rating } from '@jobs-workspace/shared'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Mock } from 'vitest'

import { renderWithQuery } from '../../test/render'
import { FitPanel } from './FitPanel'
import { useFitStore } from './fit-store'

const HASH = 'a'.repeat(64)
const RESUME = {
  text: 'Alex Sample built React applications for six years.'.repeat(2),
  textHash: HASH,
}

const NO_RESUME_TEXT = 'Add your resume to check your fit.'
const GENERIC_ERROR = 'Something went wrong on our side. Try again.'
const NOT_CONFIGURED = 'AI is not set up. Add GEMINI_API_KEY to server/.env and restart the server.'
const REJECTED =
  'The AI cited text we could not find in your resume, so this was marked not evidenced.'
const DISCLAIMER =
  'This is an estimate of how your resume matches the requirements in this posting. It is a guide to where to focus, not a verdict on whether to apply.'

// Fictional job. Posting order is deliberately mixed: nice to have items sit between required ones.
const JOB: Job = {
  id: 'job-test',
  title: 'Test Engineer',
  company: 'Fictional Co',
  level: 'Mid',
  location: 'Remote',
  summary: ['A test job.'],
  requirements: [
    { id: 'r1', kind: 'required', skill: 'React', text: 'Requirement r1' },
    { id: 'n1', kind: 'nice_to_have', skill: 'GraphQL', text: 'Requirement n1' },
    { id: 'r2', kind: 'required', skill: 'TypeScript', text: 'Requirement r2' },
    { id: 'r3', kind: 'required', skill: 'Testing', text: 'Requirement r3' },
    { id: 'r4', kind: 'required', skill: 'Accessibility', text: 'Requirement r4' },
    { id: 'n2', kind: 'nice_to_have', skill: 'Docker', text: 'Requirement n2' },
    { id: 'r5', kind: 'required', skill: 'Performance', text: 'Requirement r5' },
    { id: 'r6', kind: 'required', skill: 'State management', text: 'Requirement r6' },
  ],
  contentVersion: 'v1',
}

const REQUIRED_IDS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']
const NICE_IDS = ['n1', 'n2']

interface RatingOverride {
  rating?: Rating
  quote?: string | null
  rationale?: string
  quoteRejected?: boolean
}

// Ratings for the six required requirements, then the two nice to have ones.
function fitResponse(
  required: Rating[],
  nice: Rating[] = ['not_evidenced', 'not_evidenced'],
  overrides: Record<string, RatingOverride> = {},
  advice: Advice | null = null,
): FitResponse {
  const ids = [...REQUIRED_IDS, ...NICE_IDS]
  const all = [...required, ...nice]
  return {
    jobId: JOB.id,
    jobContentVersion: JOB.contentVersion,
    model: 'stand-in',
    promptVersion: 'p1',
    schemaVersion: 1,
    analysedAt: '2026-10-11T10:00:00.000Z',
    ratings: ids.map((id, index) => {
      const rating = all[index] ?? 'not_evidenced'
      return {
        requirementId: id,
        rating,
        quote: rating === 'not_evidenced' ? null : `Quote for ${id}`,
        rationale: `Reason for ${id}.`,
        quoteRejected: false,
        ...overrides[id],
      }
    }),
    advice,
  }
}

const FIVE_MET_ONE_PARTIAL: Rating[] = ['met', 'met', 'met', 'met', 'met', 'partial']

function seed(response: FitResponse, resumeHash = HASH) {
  useFitStore.getState().saveAnalysis({ ...response, resumeHash })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function errorResponse(code: string, status: number) {
  return jsonResponse({ error: { code, message: 'Server wording.', retryable: true } }, status)
}

let fetchMock: Mock<typeof fetch>

// An item that must exist; fails the test with a clear message instead of using a non-null assertion.
function at<T>(items: readonly T[], index: number): T {
  const found = items[index]
  if (found === undefined) throw new Error(`No item at index ${String(index)}`)
  return found
}

// The panel's own announcement region is the first status in the page; a notice may add another.
function liveRegion() {
  return at(screen.getAllByRole('status'), 0)
}

function answerWith(response: FitResponse) {
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(response)))
}

function renderPanel(resume: typeof RESUME | null = RESUME, unavailableReason?: string) {
  return renderWithQuery(
    <FitPanel job={JOB} resume={resume} unavailableReason={unavailableReason} />,
  )
}

beforeEach(() => {
  useFitStore.setState({ byJobId: {} })
  fetchMock = vi.fn<typeof fetch>()
  answerWith(fitResponse(FIVE_MET_ONE_PARTIAL))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('rendering the panel, with or without a stored result, never starts an AI request', () => {
  renderPanel()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('without a resume the check button is aria-disabled, explained, and sends nothing', async () => {
  const user = userEvent.setup()
  renderPanel(null)

  const button = screen.getByRole('button', { name: 'Check my fit' })
  await user.click(button)

  expect(button).toHaveAttribute('aria-disabled', 'true')
  expect(button).not.toHaveAttribute('disabled')
  expect(button).toHaveAccessibleDescription(NO_RESUME_TEXT)
  expect(fetchMock).not.toHaveBeenCalled()
})

test('an unavailable reason disables the button the same way, with that text', async () => {
  const user = userEvent.setup()
  renderPanel(RESUME, 'The AI service is not available right now.')

  const button = screen.getByRole('button', { name: 'Check my fit' })
  await user.click(button)

  expect(button).toHaveAttribute('aria-disabled', 'true')
  expect(button).toHaveAccessibleDescription('The AI service is not available right now.')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('a job with no result yet says so and offers the primary button', () => {
  renderPanel()

  expect(
    screen.getByText(
      'No fit check yet. Select Check my fit to compare your resume with these requirements.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check my fit' })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  )
})

test('a click sends one POST and, while it runs, shows progress and ignores a second click', async () => {
  let finish: (response: Response) => void = () => undefined
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
  )
  const user = userEvent.setup()
  renderPanel()

  const button = screen.getByRole('button', { name: 'Check my fit' })
  await user.click(button)

  await waitFor(() => {
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })
  expect(button).toHaveTextContent('Check my fit')
  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('Checking your fit')
  expect(status).toHaveTextContent('Usually 10 to 20 seconds.')
  const bar = screen.getByRole('progressbar', { name: 'Checking your fit' })
  expect(bar).not.toHaveAttribute('aria-valuenow')

  await user.click(button)

  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = at(fetchMock.mock.calls, 0)
  expect(url).toBe('/api/fit')
  expect(init?.method).toBe('POST')
  expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
    jobId: JOB.id,
    resumeText: RESUME.text,
  })

  finish(jsonResponse(fitResponse(FIVE_MET_ONE_PARTIAL)))
  expect(await screen.findByRole('button', { name: 'Check again' })).toBeInTheDocument()
})

test('a finished check shows the score block, announces it, and moves focus to Check again', async () => {
  const user = userEvent.setup()
  renderPanel()

  await user.click(screen.getByRole('button', { name: 'Check my fit' }))

  expect(
    await screen.findByRole('heading', { level: 2, name: 'Your fit for Test Engineer' }),
  ).toBeInTheDocument()
  const again = screen.getByRole('button', { name: 'Check again' })
  expect(again).toHaveFocus()
  expect(screen.queryByRole('button', { name: 'Check my fit' })).not.toBeInTheDocument()

  expect(screen.getByText('Fit estimate')).toBeInTheDocument()
  expect(screen.getByText('83%')).toBeInTheDocument()
  expect(screen.getByText('Strong fit')).toBeInTheDocument()
  expect(screen.getByText('5 of 6 required requirements met')).toBeInTheDocument()
  expect(screen.getByText(DISCLAIMER)).toBeInTheDocument()
  expect(screen.getByText('Checked 11 Oct 2026. Saved in this browser.')).toBeInTheDocument()
  expect(liveRegion()).toHaveTextContent('Fit check complete. Fit estimate 83%, Strong fit.')
  expect(useFitStore.getState().byJobId[JOB.id]?.resumeHash).toBe(HASH)
})

test('requirements render in two groups in posting order with rating, quote and reason', () => {
  seed(fitResponse(['met', 'partial', 'not_evidenced', 'met', 'met', 'met'], ['met', 'partial']))
  renderPanel()

  expect(screen.getByRole('heading', { level: 3, name: 'Requirements' })).toBeInTheDocument()
  const required = screen.getByRole('list', { name: 'Required' })
  const nice = screen.getByRole('list', { name: 'Nice to have' })
  const requiredItems = within(required).getAllByRole('listitem')
  const niceItems = within(nice).getAllByRole('listitem')

  expect(requiredItems.map((item) => item.textContent)).toEqual([
    expect.stringContaining('Requirement r1'),
    expect.stringContaining('Requirement r2'),
    expect.stringContaining('Requirement r3'),
    expect.stringContaining('Requirement r4'),
    expect.stringContaining('Requirement r5'),
    expect.stringContaining('Requirement r6'),
  ])
  expect(niceItems.map((item) => item.textContent)).toEqual([
    expect.stringContaining('Requirement n1'),
    expect.stringContaining('Requirement n2'),
  ])

  const met = at(requiredItems, 0)
  const partial = at(requiredItems, 1)
  const notEvidenced = at(requiredItems, 2)
  expect(met).toHaveTextContent('Met')
  expect(met).toHaveTextContent('From your resume:')
  expect(within(met).getByRole('blockquote')).toHaveTextContent('Quote for r1')
  expect(met).toHaveTextContent('Reason for r1.')
  expect(partial).toHaveTextContent('Partial')
  expect(within(partial).getByRole('blockquote')).toHaveTextContent('Quote for r2')
  expect(notEvidenced).toHaveTextContent('Not evidenced')
  expect(within(notEvidenced).queryByRole('blockquote')).not.toBeInTheDocument()
  expect(notEvidenced).not.toHaveTextContent('From your resume:')

  // The glyph beside each word is decoration.
  const glyphs = required.querySelectorAll('[aria-hidden="true"]')
  expect(glyphs.length).toBeGreaterThanOrEqual(6)
})

test('a rating whose quote was rejected shows Not evidenced and the explanation', () => {
  seed(
    fitResponse(FIVE_MET_ONE_PARTIAL, undefined, {
      r1: { rating: 'not_evidenced', quote: null, rationale: '', quoteRejected: true },
    }),
  )
  renderPanel()

  const item = at(
    within(screen.getByRole('list', { name: 'Required' })).getAllByRole('listitem'),
    0,
  )
  expect(item).toHaveTextContent('Not evidenced')
  expect(item).toHaveTextContent(REJECTED)
  expect(within(item).queryByRole('blockquote')).not.toBeInTheDocument()
})

test('a failed check shows one alert with a Try again that repeats the request on click only', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(errorResponse('ai_overloaded', 503)))
  const user = userEvent.setup()
  renderPanel()

  await user.click(screen.getByRole('button', { name: 'Check my fit' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not check your fit')
  expect(alert).toHaveTextContent(GENERIC_ERROR)
  expect(alert).not.toHaveTextContent('Server wording.')
  expect(screen.getAllByRole('alert')).toHaveLength(1)
  expect(fetchMock).toHaveBeenCalledTimes(1)

  answerWith(fitResponse(FIVE_MET_ONE_PARTIAL))
  await user.click(within(alert).getByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('83%')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('an unconfigured AI service shows the set-up message and no retry button', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(errorResponse('ai_not_configured', 503)))
  const user = userEvent.setup()
  renderPanel()

  await user.click(screen.getByRole('button', { name: 'Check my fit' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(NOT_CONFIGURED)
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
})

test('a failed Check again keeps the previous result visible below the notice', async () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL))
  fetchMock.mockImplementation(() => Promise.resolve(errorResponse('ai_failed', 502)))
  const user = userEvent.setup()
  renderPanel()

  await user.click(screen.getByRole('button', { name: 'Check again' }))

  const alert = await screen.findByRole('alert')
  const list = screen.getByRole('list', { name: 'Required' })
  expect(screen.getByText('83%')).toBeInTheDocument()
  expect(alert.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('a stored result is shown at once and sends no request', () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL))
  renderPanel()

  expect(screen.getByText('83%')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
  expect(liveRegion()).toHaveTextContent('')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('a stored result for a different resume is not shown', () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL), 'b'.repeat(64))
  renderPanel()

  expect(screen.queryByText('83%')).not.toBeInTheDocument()
  expect(screen.getByText(/No fit check yet\./)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check my fit' })).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('markup in a rationale or quote is shown as literal text and creates no element', () => {
  const markup = '<img src=x onerror="window.__pwned = true">'
  seed(
    fitResponse(FIVE_MET_ONE_PARTIAL, undefined, {
      r1: { rationale: markup, quote: '<b>bold</b>' },
    }),
  )
  const { container } = renderPanel()

  expect(screen.getByText(markup)).toBeInTheDocument()
  expect(screen.getByText('<b>bold</b>')).toBeInTheDocument()
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('b')).toBeNull()
})

test.each([
  ['Strong fit', ['met', 'met', 'met', 'met', 'met', 'met'], 'bg-green-50'],
  ['Good fit', ['met', 'met', 'met', 'met', 'not_evidenced', 'not_evidenced'], 'bg-teal-50'],
  [
    'Stretch',
    ['met', 'met', 'met', 'not_evidenced', 'not_evidenced', 'not_evidenced'],
    'bg-amber-50',
  ],
  [
    'Long shot',
    ['met', 'not_evidenced', 'not_evidenced', 'not_evidenced', 'not_evidenced', 'not_evidenced'],
    'bg-gray-100',
  ],
] as const)('the %s band uses its tone', (band, required, toneClass) => {
  seed(fitResponse([...required]))
  renderPanel()

  expect(screen.getByText(band)).toHaveClass(toneClass)
})

test('rating tones are success, caution and neutral, and nothing uses the danger tone', () => {
  seed(fitResponse(['met', 'partial', 'not_evidenced', 'met', 'met', 'met']))
  const { container } = renderPanel()
  const items = within(screen.getByRole('list', { name: 'Required' })).getAllByRole('listitem')

  expect(within(at(items, 0)).getByText('Met').parentElement).toHaveClass('bg-green-50')
  expect(within(at(items, 1)).getByText('Partial').parentElement).toHaveClass('bg-amber-50')
  expect(within(at(items, 2)).getByText('Not evidenced').parentElement).toHaveClass('bg-gray-100')
  expect(container.innerHTML).not.toMatch(/red-/)
})

test('a stored result with learning plans shows the Gaps section after the Requirements list', () => {
  seed(
    fitResponse(
      FIVE_MET_ONE_PARTIAL,
      ['not_evidenced', 'met'],
      {},
      {
        plans: [
          {
            requirementId: 'r6',
            steps: ['Read the state management guide'],
            whyItMatters: 'Because r6.',
            effort: 'days',
          },
        ],
        tailoring: null,
      },
    ),
  )
  renderPanel()

  const requirements = screen.getByRole('heading', { level: 3, name: 'Requirements' })
  const gaps = screen.getByRole('heading', { level: 3, name: 'Gaps' })
  expect(requirements.compareDocumentPosition(gaps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('heading', { level: 4, name: 'Required gaps (1)' })).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { level: 4, name: 'Nice-to-have gaps (1)' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Read the state management guide')).toBeInTheDocument()
})

const OLD_RESULT_SENTENCE =
  'Learning plans and tailoring tips are new. Check again to add them to this result.'
const NOTICE_BUTTON = 'Check again to add learning plans and tips'
const R6_ADVICE: Advice = {
  plans: [
    {
      requirementId: 'r6',
      steps: ['Read the state management guide'],
      whyItMatters: 'Because r6.',
      effort: 'days',
    },
  ],
  tailoring: null,
}

test('a result saved before learning plans existed offers Check again under the Gaps heading', () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL))
  renderPanel()

  const notice = screen
    .getAllByRole('status')
    .find((region) => region.textContent.includes(OLD_RESULT_SENTENCE))
  if (notice === undefined) throw new Error('The old-result notice is missing')
  const gaps = screen.getByRole('heading', { level: 3, name: 'Gaps' })
  const groups = screen.getByRole('heading', { level: 4, name: 'Required gaps (1)' })
  expect(gaps.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(notice.compareDocumentPosition(groups) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const button = within(notice).getByRole('button', { name: NOTICE_BUTTON })
  expect(button).toHaveTextContent('Check again')
  expect(button).not.toHaveAttribute('aria-disabled', 'true')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('an old result shows its gaps with no plan area and no missing-plan line', () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL))
  renderPanel()

  expect(screen.getByText('partly evidenced in your resume')).toBeInTheDocument()
  expect(screen.queryByText('What to learn')).not.toBeInTheDocument()
  expect(screen.queryByText(/No learning plan was generated/)).not.toBeInTheDocument()
})

test('a result that has learning plans shows no old-result notice', () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL, undefined, {}, R6_ADVICE))
  renderPanel()

  expect(screen.queryByText(OLD_RESULT_SENTENCE)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: NOTICE_BUTTON })).not.toBeInTheDocument()
})

test('the notice button sends one request, adds the plans, keeps the score and removes the notice', async () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL))
  answerWith(fitResponse(FIVE_MET_ONE_PARTIAL, undefined, {}, R6_ADVICE))
  const user = userEvent.setup()
  renderPanel()
  expect(screen.getByText('83%')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: NOTICE_BUTTON }))

  expect(await screen.findByText('Read the state management guide')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = at(fetchMock.mock.calls, 0)
  expect(url).toBe('/api/fit')
  expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
    jobId: JOB.id,
    resumeText: RESUME.text,
  })
  expect(screen.getByText('83%')).toBeInTheDocument()
  expect(screen.queryByText(OLD_RESULT_SENTENCE)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: NOTICE_BUTTON })).not.toBeInTheDocument()
})

test('focus moves to the header Check again button when the notice button is used', async () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL))
  let finish: (response: Response) => void = () => undefined
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
  )
  const user = userEvent.setup()
  renderPanel()

  await user.click(screen.getByRole('button', { name: NOTICE_BUTTON }))

  // While the check runs the notice is hidden, and focus has not fallen back to the page.
  const header = screen.getByRole('button', { name: 'Check again' })
  expect(header).toHaveFocus()
  expect(header).toHaveAttribute('aria-disabled', 'true')

  finish(jsonResponse(fitResponse(FIVE_MET_ONE_PARTIAL, undefined, {}, R6_ADVICE)))
  expect(await screen.findByText('Read the state management guide')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check again' })).toHaveFocus()
})

test('the header Check again button also adds the plans and focus stays on it', async () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL))
  answerWith(fitResponse(FIVE_MET_ONE_PARTIAL, undefined, {}, R6_ADVICE))
  const user = userEvent.setup()
  renderPanel()

  await user.click(screen.getByRole('button', { name: 'Check again' }))

  expect(await screen.findByText('Read the state management guide')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.queryByText(OLD_RESULT_SENTENCE)).not.toBeInTheDocument()
})

test('a failed check from the notice keeps the old result and its notice below the error', async () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL))
  fetchMock.mockImplementation(() => Promise.resolve(errorResponse('ai_failed', 502)))
  const user = userEvent.setup()
  renderPanel()

  await user.click(screen.getByRole('button', { name: NOTICE_BUTTON }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(GENERIC_ERROR)
  expect(screen.getByText('83%')).toBeInTheDocument()
  expect(screen.getByText(OLD_RESULT_SENTENCE)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: NOTICE_BUTTON })).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('the notice button is unavailable the same way as the header button, and sends nothing', async () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL))
  const user = userEvent.setup()
  renderPanel(RESUME, 'The AI service is not available right now.')

  const button = screen.getByRole('button', { name: NOTICE_BUTTON })
  await user.click(button)

  expect(button).toHaveAttribute('aria-disabled', 'true')
  expect(button).not.toHaveAttribute('disabled')
  expect(button).toHaveAccessibleDescription('The AI service is not available right now.')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('the first check still moves focus to Check again once the result appears', async () => {
  answerWith(fitResponse(FIVE_MET_ONE_PARTIAL, undefined, {}, R6_ADVICE))
  const user = userEvent.setup()
  renderPanel()

  await user.click(screen.getByRole('button', { name: 'Check my fit' }))

  expect(await screen.findByRole('button', { name: 'Check again' })).toHaveFocus()
})

test('the panel keeps one announcement region of its own and adds only the notice', () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL))
  renderPanel()

  expect(screen.getAllByRole('status')).toHaveLength(2)
  expect(liveRegion()).toHaveTextContent('')
})

const TAILORED_ADVICE: Advice = {
  plans: R6_ADVICE.plans,
  tailoring: {
    emphasise: [{ quote: 'Quote for r1', advice: 'Say it first.' }],
    keywords: ['Kubernetes'],
  },
}

test('a stored result with advice shows the Tailoring section after the Gaps section', () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL, undefined, {}, TAILORED_ADVICE))
  renderPanel()

  const gaps = screen.getByRole('heading', { level: 3, name: 'Gaps' })
  const tailoring = screen.getByRole('heading', {
    level: 3,
    name: 'Tailoring your resume for this job',
  })
  expect(gaps.compareDocumentPosition(tailoring) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByText('Say it first.')).toBeInTheDocument()
  expect(screen.getByText('Kubernetes')).toBeInTheDocument()
})

test('a stored result with no advice shows no Tailoring heading', () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL))
  renderPanel()

  expect(screen.getByRole('heading', { level: 3, name: 'Gaps' })).toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Tailoring your resume for this job' }),
  ).not.toBeInTheDocument()
})

test('while a check runs the Tailoring section is not rendered', async () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL, undefined, {}, TAILORED_ADVICE))
  fetchMock.mockImplementation(() => new Promise<Response>(() => undefined))
  const user = userEvent.setup()
  renderPanel()
  expect(
    screen.getByRole('heading', { level: 3, name: 'Tailoring your resume for this job' }),
  ).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Check again' }))

  await screen.findByRole('progressbar', { name: 'Checking your fit' })
  expect(
    screen.queryByRole('heading', { name: 'Tailoring your resume for this job' }),
  ).not.toBeInTheDocument()
})

test('a failed re-check keeps the previous tips and keywords below the error notice', async () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL, undefined, {}, TAILORED_ADVICE))
  fetchMock.mockImplementation(() => Promise.resolve(errorResponse('ai_failed', 502)))
  const user = userEvent.setup()
  renderPanel()

  await user.click(screen.getByRole('button', { name: 'Check again' }))

  const alert = await screen.findByRole('alert')
  const tip = screen.getByText('Say it first.')
  expect(alert.compareDocumentPosition(tip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('list', { name: 'Emphasise what you already have' })).toBeInTheDocument()
  expect(screen.getByText('Kubernetes')).toBeInTheDocument()
})

test('an old result shows the old-result notice and no Tailoring section', () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL))
  renderPanel()

  expect(screen.getByText(OLD_RESULT_SENTENCE)).toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Tailoring your resume for this job' }),
  ).not.toBeInTheDocument()
})

test('advice with unusable tailoring shows the heading and the unavailable line, no old-result notice', () => {
  seed(fitResponse(FIVE_MET_ONE_PARTIAL, undefined, {}, R6_ADVICE))
  renderPanel()

  expect(
    screen.getByRole('heading', { level: 3, name: 'Tailoring your resume for this job' }),
  ).toBeInTheDocument()
  expect(
    screen.getByText(
      'Tailoring tips could not be generated for this check. Check again to try once more.',
    ),
  ).toBeInTheDocument()
  expect(screen.queryByText(OLD_RESULT_SENTENCE)).not.toBeInTheDocument()
})
