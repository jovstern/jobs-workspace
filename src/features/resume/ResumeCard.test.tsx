import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'

import { ResumeCard } from './ResumeCard'
import { buildResumeRecord, useResumeStore } from './resume-store'

// Synthetic resume: a fictional person with no contact details.
const TEXT = [
  'Sam Example, Frontend Engineer',
  'Built React single page applications for a logistics start-up over six years.',
  'Wrote TypeScript in strict mode across a shared component package.',
].join('\n')

beforeEach(() => {
  useResumeStore.setState({ resume: null })
})

test('with no resume shows the heading, the empty copy and the form', () => {
  render(<ResumeCard />)

  const region = screen.getByRole('region', { name: 'Your resume' })
  expect(within(region).getByRole('heading', { level: 2, name: 'Your resume' })).toBeInTheDocument()
  expect(within(region).getByText('No resume yet')).toBeInTheDocument()
  expect(within(region).getByText('Add your resume to check your fit.')).toBeInTheDocument()
  expect(within(region).getByLabelText('Paste your resume text')).toBeInTheDocument()
})

test('with a stored resume shows the saved line with the character count and no form', async () => {
  const { record } = await buildResumeRecord(TEXT, '2026-10-11T10:00:00.000Z')
  useResumeStore.setState({ resume: record })

  render(<ResumeCard />)

  expect(
    screen.getByText(`Resume saved. ${String(record.text.length)} characters.`),
  ).toBeInTheDocument()
  expect(screen.queryByLabelText('Paste your resume text')).not.toBeInTheDocument()
  expect(screen.queryByText('No resume yet')).not.toBeInTheDocument()
})

test('shows the privacy note in full when there is no resume', () => {
  render(<ResumeCard />)

  const region = screen.getByRole('region', { name: 'Your resume' })
  const heading = within(region).getByRole('heading', { level: 2, name: 'How your resume is used' })
  expect(heading).toBeVisible()
  expect(
    within(region).getByText('Your resume, profile and fit checks are saved only in this browser.'),
  ).toBeVisible()
  expect(heading.closest('details')).toBeNull()
})

test('shows the privacy note in full when a resume is saved', async () => {
  const { record } = await buildResumeRecord(TEXT, '2026-10-11T10:00:00.000Z')
  useResumeStore.setState({ resume: record })

  render(<ResumeCard />)

  const region = screen.getByRole('region', { name: 'Your resume' })
  const heading = within(region).getByRole('heading', { level: 2, name: 'How your resume is used' })
  expect(heading).toBeVisible()
  expect(
    within(region).getByText('Your resume, profile and fit checks are saved only in this browser.'),
  ).toBeVisible()
  expect(heading.closest('details')).toBeNull()
})

test('shows no Review, Replace or Delete button in either state', async () => {
  const { unmount } = render(<ResumeCard />)
  expect(screen.queryByRole('button', { name: /review resume|replace|delete/i })).toBeNull()
  unmount()

  const { record } = await buildResumeRecord(TEXT, '2026-10-11T10:00:00.000Z')
  useResumeStore.setState({ resume: record })
  render(<ResumeCard />)

  expect(screen.queryByRole('button')).toBeNull()
})

test('announces Resume saved. in a hidden status region after the user saves', async () => {
  const user = userEvent.setup()
  render(<ResumeCard />)
  const announcement = screen.getByRole('status')
  expect(announcement).toBeEmptyDOMElement()

  await user.click(screen.getByLabelText('Paste your resume text'))
  await user.paste(TEXT)
  await user.click(screen.getByRole('button', { name: 'Review text' }))
  await user.click(screen.getByRole('button', { name: 'Save resume' }))

  expect(await screen.findByText(/^Resume saved\. \d+ characters\.$/)).toBeInTheDocument()
  expect(announcement).toHaveTextContent('Resume saved.')
  expect(screen.queryByLabelText('Paste your resume text')).not.toBeInTheDocument()
})
