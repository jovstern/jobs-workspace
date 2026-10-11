import type { Job } from '@jobs-workspace/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { App } from '../../App'
import { renderWithQuery } from '../../test/render'
import { JobDetail } from './JobDetail'

// Fictional company, invented requirements.
const JOB: Job = {
  id: 'job-test',
  title: 'Test Engineer',
  company: 'Fictional Co',
  level: 'Senior',
  location: 'Remote (Europe)',
  summary: ['First paragraph of the posting.', 'Second paragraph of the posting.'],
  requirements: [
    { id: 'r1', kind: 'required', skill: 'React', text: 'Requirement one' },
    { id: 'r2', kind: 'nice_to_have', skill: 'GraphQL', text: 'Requirement two' },
    { id: 'r3', kind: 'required', skill: 'Testing', text: 'Requirement three' },
    { id: 'r4', kind: 'required', skill: 'TypeScript', text: 'Requirement four' },
    { id: 'r5', kind: 'required', skill: 'Accessibility', text: 'Requirement five' },
    { id: 'r6', kind: 'required', skill: 'Performance', text: 'Requirement six' },
    { id: 'r7', kind: 'nice_to_have', skill: 'Mentoring', text: 'Requirement seven' },
  ],
  contentVersion: 'v1',
}

let fetchMock: ReturnType<typeof vi.fn>
let healthResponse: () => Promise<Response>

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  healthResponse = () => Promise.resolve(json({ status: 'ok', aiConfigured: true }))
  fetchMock = vi.fn((input: string) =>
    input === '/api/health' ? healthResponse() : Promise.resolve(json({ jobs: [JOB] })),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows the title, the meta line and each summary paragraph', () => {
  renderWithQuery(<JobDetail job={JOB} resume={null} />)

  // The tracer fit panel repeats the title in its own heading until plan 01-10 replaces it with
  // "Your fit for {title}", so the posting's heading is the first one.
  const headings = screen.getAllByRole('heading', { level: 2, name: 'Test Engineer' })
  expect(headings[0]?.closest('section')).toContainElement(
    screen.getByText('Fictional Co · Senior · Remote (Europe)'),
  )
  expect(screen.getByText('Fictional Co · Senior · Remote (Europe)')).toBeInTheDocument()
  expect(screen.getByText('First paragraph of the posting.')).toBeInTheDocument()
  expect(screen.getByText('Second paragraph of the posting.')).toBeInTheDocument()
})

test('lists the required and nice to have requirements under their own headings, in posting order', () => {
  renderWithQuery(<JobDetail job={JOB} resume={null} />)

  const required = screen.getByRole('heading', { level: 3, name: 'Required' })
  const nice = screen.getByRole('heading', { level: 3, name: 'Nice to have' })
  expect(required.compareDocumentPosition(nice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

  const requiredList = required.nextElementSibling as HTMLElement
  const niceList = nice.nextElementSibling as HTMLElement
  expect(
    within(requiredList)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual([
    'Requirement one',
    'Requirement three',
    'Requirement four',
    'Requirement five',
    'Requirement six',
  ])
  expect(
    within(niceList)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['Requirement two', 'Requirement seven'])
})

test('shows the fit region below the posting without starting a request', () => {
  renderWithQuery(<JobDetail job={JOB} resume={null} />)

  const posting = screen.getByRole('heading', { level: 3, name: 'Nice to have' })
  const check = screen.getByRole('button', { name: 'Check my fit' })
  expect(posting.compareDocumentPosition(check) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(fetchMock).not.toHaveBeenCalledWith('/api/fit', expect.anything())
})

test('with no job selected the detail area asks the user to select a job', async () => {
  renderWithQuery(<App />)

  expect(await screen.findByRole('heading', { level: 2, name: 'Select a job' })).toBeInTheDocument()
  expect(
    screen.getByText('Choose a job on the left to read its requirements and check your fit.'),
  ).toBeInTheDocument()
})

test('the page has one header, one main and three labelled sections', async () => {
  const user = userEvent.setup()
  renderWithQuery(<App />)

  await user.click(await screen.findByRole('button', { name: /Test Engineer/ }))

  expect(screen.getAllByRole('banner')).toHaveLength(1)
  expect(screen.getAllByRole('main')).toHaveLength(1)
  expect(screen.getByRole('heading', { level: 1, name: 'Jobs Workspace' })).toBeInTheDocument()
  expect(
    screen.getByText('Pick a job to see how your resume matches its requirements.'),
  ).toBeInTheDocument()
  for (const name of ['Your resume', 'Jobs']) {
    expect(screen.getByRole('region', { name })).toBeInTheDocument()
  }
})

test('selecting a job shows its posting next to the list', async () => {
  const user = userEvent.setup()
  renderWithQuery(<App />)

  await user.click(await screen.findByRole('button', { name: /Test Engineer/ }))

  expect(screen.getByRole('heading', { level: 3, name: 'Required' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Select a job' })).not.toBeInTheDocument()
})

const NOT_CONFIGURED =
  'AI is not set up. Add GEMINI_API_KEY to server/.env and restart the server. Fit checks are unavailable until then.'
const UNREACHABLE = "Can't reach the app server (is it running?)"
const RESUME = { text: 'Sam Example, Frontend Engineer', textHash: 'hash-1' }

test('when health says AI is not configured, shows a status notice and explains the disabled button', async () => {
  healthResponse = () => Promise.resolve(json({ status: 'ok', aiConfigured: false }))
  renderWithQuery(<JobDetail job={JOB} resume={RESUME} />)

  const notice = await screen.findByText(NOT_CONFIGURED)
  expect(notice.closest('[role="status"]')).not.toBeNull()

  const check = screen.getByRole('button', { name: 'Check my fit' })
  expect(check).toHaveAttribute('aria-disabled', 'true')
  expect(check).toHaveAccessibleDescription('AI is not set up.')
})

test('when the health request fails, says the app server cannot be reached and disables the button', async () => {
  healthResponse = () => Promise.reject(new TypeError('network down'))
  renderWithQuery(<JobDetail job={JOB} resume={RESUME} />)

  const messages = await screen.findAllByText(UNREACHABLE)
  expect(messages[0]?.closest('[role="status"]')).not.toBeNull()

  const check = screen.getByRole('button', { name: 'Check my fit' })
  expect(check).toHaveAttribute('aria-disabled', 'true')
  expect(check).toHaveAccessibleDescription(UNREACHABLE)
})

test('when health says AI is configured, shows no notice and leaves the button available', async () => {
  renderWithQuery(<JobDetail job={JOB} resume={RESUME} />)

  await vi.waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything())
  })
  // Let the answer settle into the page before asserting that nothing appeared.
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(screen.getByRole('button', { name: 'Check my fit' })).toHaveAttribute(
    'aria-disabled',
    'false',
  )
  expect(screen.queryByText(/AI is not set up/)).not.toBeInTheDocument()
  expect(screen.queryByText(UNREACHABLE)).not.toBeInTheDocument()
})

test('while health is still loading, shows no notice and leaves the button available', () => {
  healthResponse = () => new Promise<Response>(() => undefined)
  renderWithQuery(<JobDetail job={JOB} resume={RESUME} />)

  expect(screen.getByRole('button', { name: 'Check my fit' })).toHaveAttribute(
    'aria-disabled',
    'false',
  )
  expect(screen.queryByText(/AI is not set up/)).not.toBeInTheDocument()
  expect(screen.queryByText(UNREACHABLE)).not.toBeInTheDocument()
})
