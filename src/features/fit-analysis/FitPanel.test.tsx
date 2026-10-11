import type { FitResponse, Job } from '@jobs-workspace/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { FitPanel } from './FitPanel'
import { useFitStore } from './fit-store'

const HASH = 'a'.repeat(64)
const RESUME = {
  text: 'Alex Sample built React applications for six years.'.repeat(2),
  textHash: HASH,
}

const JOB: Job = {
  id: 'job-test',
  title: 'Test Engineer',
  company: 'Fictional Co',
  level: 'Mid',
  location: 'Remote',
  summary: ['A test job.'],
  requirements: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'].map((id) => ({
    id,
    kind: 'required' as const,
    skill: 'React' as const,
    text: `Requirement ${id}`,
  })),
  contentVersion: 'v1',
}

function fitResponse(): FitResponse {
  return {
    jobId: JOB.id,
    jobContentVersion: JOB.contentVersion,
    model: 'stand-in',
    promptVersion: 'p1',
    schemaVersion: 1,
    analysedAt: '2026-10-11T10:00:00.000Z',
    ratings: JOB.requirements.map((requirement, index) => ({
      requirementId: requirement.id,
      rating: index === 0 ? ('met' as const) : ('not_evidenced' as const),
      quote: index === 0 ? 'built React applications' : null,
      rationale: 'ok',
      quoteRejected: false,
    })),
    advice: null,
  }
}

function renderPanel(resume: typeof RESUME | null) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <FitPanel job={JOB} resume={resume} />
    </QueryClientProvider>,
  )
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  useFitStore.setState({ byJobId: {} })
  fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(fitResponse()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('rendering the panel never starts an AI request', () => {
  renderPanel(RESUME)

  expect(fetchMock).not.toHaveBeenCalled()
})

test('the button does nothing without a resume', async () => {
  const user = userEvent.setup()
  renderPanel(null)

  const button = screen.getByRole('button', { name: 'Check my fit' })
  await user.click(button)

  expect(button).toHaveAttribute('aria-disabled', 'true')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('a click starts one request and the answer is shown and stored', async () => {
  const user = userEvent.setup()
  renderPanel(RESUME)

  await user.click(screen.getByRole('button', { name: 'Check my fit' }))

  const list = await screen.findByRole('list', { name: 'Rated requirements' })
  expect(list.querySelectorAll('li')).toHaveLength(6)
  expect(screen.getByText('Met')).toBeInTheDocument()
  expect(screen.getByText('From your resume:')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(useFitStore.getState().byJobId[JOB.id]?.resumeHash).toBe(HASH)
})

test('a stored analysis is shown at once and sends no request', () => {
  useFitStore.getState().saveAnalysis({ ...fitResponse(), resumeHash: HASH })
  renderPanel(null)

  expect(screen.getByRole('list', { name: 'Rated requirements' })).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('a failed check shows the error and sends no automatic retry', async () => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        error: {
          code: 'ai_failed',
          message: 'Something went wrong on our side. Try again.',
          retryable: true,
        },
      }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    ),
  )
  const user = userEvent.setup()
  renderPanel(RESUME)

  await user.click(screen.getByRole('button', { name: 'Check my fit' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
