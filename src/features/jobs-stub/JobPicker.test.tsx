import type { Job } from '@jobs-workspace/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { renderWithQuery } from '../../test/render'
import { JobPicker } from './JobPicker'

// Fictional companies and invented titles only.
function makeJob(index: number): Job {
  return {
    id: `job-test-${String(index)}`,
    title: `Test Engineer ${String(index)}`,
    company: `Fictional Co ${String(index)}`,
    level: 'Mid',
    location: 'Remote (Europe)',
    summary: ['A test job.'],
    requirements: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'].map((id) => ({
      id: `${String(index)}-${id}`,
      kind: 'required' as const,
      skill: 'React' as const,
      text: `Requirement ${id}`,
    })),
    contentVersion: 'v1',
  }
}

const NINE_JOBS = Array.from({ length: 9 }, (_, index) => makeJob(index + 1))

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ jobs: NINE_JOBS })))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows a Loading jobs status line while the request is pending', () => {
  fetchMock.mockReturnValue(new Promise(() => undefined))
  renderWithQuery(<JobPicker selectedJobId={null} onSelect={() => undefined} />)

  expect(screen.getByRole('status')).toHaveTextContent('Loading jobs')
})

test('shows the failure message with a Try again button that sends the request again', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('network down'))
  const user = userEvent.setup()
  renderWithQuery(<JobPicker selectedJobId={null} onSelect={() => undefined} />)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load the jobs. Check that the app server is running.',
  )
  expect(fetchMock).toHaveBeenCalledTimes(1)

  await user.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findAllByRole('listitem')).toHaveLength(9)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('shows the empty message when the server has no jobs', async () => {
  fetchMock.mockResolvedValue(jsonResponse({ jobs: [] }))
  renderWithQuery(<JobPicker selectedJobId={null} onSelect={() => undefined} />)

  expect(
    await screen.findByText('No jobs to show. Check that the app server has its seed data.'),
  ).toBeInTheDocument()
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})

test('renders nine job buttons inside list items with title and the company, level and location line', async () => {
  renderWithQuery(<JobPicker selectedJobId={null} onSelect={() => undefined} />)

  const items = await screen.findAllByRole('listitem')
  expect(items).toHaveLength(9)
  for (const [index, item] of items.entries()) {
    const job = NINE_JOBS[index]
    expect(within(item).getByRole('button')).toBeInTheDocument()
    expect(within(item).getByText(job?.title ?? '')).toBeInTheDocument()
    expect(
      within(item).getByText(
        `${job?.company ?? ''} · ${job?.level ?? ''} · ${job?.location ?? ''}`,
      ),
    ).toBeInTheDocument()
  }
})

test('marks only the selected job with aria-current and calls onSelect with the clicked job', async () => {
  const onSelect = vi.fn()
  const user = userEvent.setup()
  renderWithQuery(<JobPicker selectedJobId="job-test-3" onSelect={onSelect} />)

  const selected = await screen.findByRole('button', { name: /Test Engineer 3/ })
  expect(selected).toHaveAttribute('aria-current', 'true')
  expect(
    screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-current')),
  ).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: /Test Engineer 5/ }))

  expect(onSelect).toHaveBeenCalledWith(NINE_JOBS[4])
})

test('lets a long title wrap instead of cutting it off', async () => {
  const longTitle = 'Principal Staff Distinguished Engineer of Everything '.repeat(2).slice(0, 100)
  fetchMock.mockResolvedValue(jsonResponse({ jobs: [{ ...makeJob(1), title: longTitle }] }))
  renderWithQuery(<JobPicker selectedJobId={null} onSelect={() => undefined} />)

  const title = await screen.findByText(longTitle)
  expect(title.className).toContain('break-words')
  expect(title.className).not.toContain('truncate')
})

test('shows Checking fit in the row of a job whose fit check is pending', async () => {
  const { client } = renderWithQuery(<JobPicker selectedJobId={null} onSelect={() => undefined} />)
  const [first, second] = await screen.findAllByRole('listitem')
  if (first === undefined || second === undefined) throw new Error('expected job rows')

  // A check that never answers, started the way the fit panel starts one.
  void client
    .getMutationCache()
    .build(client, {
      mutationKey: ['fit'],
      mutationFn: () => new Promise<never>(() => undefined),
    })
    .execute({ jobId: 'job-test-2', resumeText: 'x', resumeHash: 'h' })

  expect(await within(second).findByText('Checking fit')).toBeInTheDocument()
  expect(within(first).queryByText('Checking fit')).not.toBeInTheDocument()
})
