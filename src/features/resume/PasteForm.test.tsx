import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

import { PasteForm } from './PasteForm'
import { useResumeStore } from './resume-store'

// Synthetic resume: a fictional person; every contact value is invented (example.com, 555 01xx).
const BODY = [
  'Built React single page applications for a logistics start-up over six years.',
  'Wrote TypeScript in strict mode across a shared component package.',
].join('\n')

const WITH_CONTACTS = [
  'Sam Example',
  'sam.example@example.com | +1 555 0142 | https://example.com/sam',
  '42 Example Street, Springfield, IL 62704',
  BODY,
].join('\n')

const WITH_PAIRS = [
  'Sam Example',
  'sam.a@example.com | sam.b@example.com',
  '+1 555 0142 | +1 555 0143',
  'https://example.com/a https://example.org/b',
  '42 Example Street, Springfield, IL 62704',
  '7 Sample Road, Shelbyville',
  BODY,
].join('\n')

const WITHOUT_CONTACTS = ['Sam Example', BODY].join('\n')

const SHORT = 'Paste at least 50 characters of resume text.'
const LONG = 'The text is longer than 60,000 characters. Shorten it and try again.'

beforeEach(() => {
  useResumeStore.setState({ resume: null })
})

async function paste(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByLabelText('Paste your resume text'))
  await user.paste(text)
}

test('has one labelled textarea and a Review text button', () => {
  render(<PasteForm />)

  expect(screen.getByLabelText('Paste your resume text').tagName).toBe('TEXTAREA')
  expect(screen.getByRole('button', { name: 'Review text' })).toBeInTheDocument()
})

test('shows the short-text message for an empty paste and saves nothing', async () => {
  const user = userEvent.setup()
  render(<PasteForm />)

  await user.click(screen.getByRole('button', { name: 'Review text' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(SHORT)
  const field = screen.getByLabelText('Paste your resume text')
  expect(field).toHaveAttribute('aria-invalid', 'true')
  expect(field).toHaveAttribute('aria-describedby', alert.id)
  expect(useResumeStore.getState().resume).toBeNull()
  expect(localStorage.getItem('jw:resume')).toBeNull()
})

test('shows the short-text message for a paste under 50 characters and saves nothing', async () => {
  const user = userEvent.setup()
  render(<PasteForm />)

  await paste(user, 'Twenty characters!!!')
  await user.click(screen.getByRole('button', { name: 'Review text' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(SHORT)
  expect(screen.getByRole('button', { name: 'Review text' })).toBeInTheDocument()
  expect(useResumeStore.getState().resume).toBeNull()
  expect(localStorage.getItem('jw:resume')).toBeNull()
})

test('shows the too-long message for a paste over 60,000 characters', async () => {
  const user = userEvent.setup()
  render(<PasteForm />)

  await paste(user, 'a'.repeat(60001))
  await user.click(screen.getByRole('button', { name: 'Review text' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(LONG)
  expect(useResumeStore.getState().resume).toBeNull()
})

test('replaces contact details with placeholders and reports what was removed', async () => {
  const user = userEvent.setup()
  render(<PasteForm />)

  await paste(user, WITH_CONTACTS)
  await user.click(screen.getByRole('button', { name: 'Review text' }))

  const field = screen.getByLabelText('Paste your resume text')
  expect(field).toHaveValue(
    [
      'Sam Example',
      '[email removed] | [phone removed] | [link removed]',
      '[address removed]',
      BODY,
    ].join('\n'),
  )
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Removed before anything is sent to Google: 1 email address, 1 phone number, 1 street address, 1 link. Your name is kept. This catches common formats only. Check the text below for anything else you want to remove.',
  )
  expect(
    screen.getByText(
      'Removed details appear as [email removed], [phone removed], [address removed] and [link removed].',
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save resume' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Review text' })).not.toBeInTheDocument()
  expect(useResumeStore.getState().resume).toBeNull()
})

test('uses plural wording and leaves out kinds with a zero count', async () => {
  const user = userEvent.setup()
  render(<PasteForm />)

  await paste(user, WITH_PAIRS)
  await user.click(screen.getByRole('button', { name: 'Review text' }))

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Removed before anything is sent to Google: 2 email addresses, 2 phone numbers, 2 street addresses, 2 links. Your name is kept.',
  )
})

test('says nothing was found when there is nothing to remove', async () => {
  const user = userEvent.setup()
  render(<PasteForm />)

  await paste(user, WITHOUT_CONTACTS)
  await user.click(screen.getByRole('button', { name: 'Review text' }))

  expect(await screen.findByRole('status')).toHaveTextContent(
    'We did not find an email address, phone number, street address or link to remove. Check the text below for anything else you want to remove.',
  )
  expect(screen.getByRole('button', { name: 'Save resume' })).toBeInTheDocument()
})

test('removes an email address typed into the reviewed text and saves only on the next click', async () => {
  const user = userEvent.setup()
  render(<PasteForm />)
  await paste(user, WITHOUT_CONTACTS)
  await user.click(screen.getByRole('button', { name: 'Review text' }))
  const field = screen.getByLabelText('Paste your resume text')

  await user.click(field)
  await user.paste('\nlate.addition@example.com')
  await user.click(screen.getByRole('button', { name: 'Save resume' }))

  expect(field).toHaveValue(`${WITHOUT_CONTACTS}\n[email removed]`)
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Removed before anything is sent to Google: 1 email address. Your name is kept.',
  )
  expect(screen.getByRole('button', { name: 'Save resume' })).toBeInTheDocument()
  expect(useResumeStore.getState().resume).toBeNull()
  expect(localStorage.getItem('jw:resume')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Save resume' }))

  expect(useResumeStore.getState().resume?.text).toBe(`${WITHOUT_CONTACTS}\n[email removed]`)
})

test('saves the contact-free text with its hash and calls onSaved', async () => {
  const user = userEvent.setup()
  const onSaved = vi.fn()
  render(<PasteForm onSaved={onSaved} />)
  await paste(user, WITH_CONTACTS)
  await user.click(screen.getByRole('button', { name: 'Review text' }))

  await user.click(screen.getByRole('button', { name: 'Save resume' }))

  await vi.waitFor(() => {
    expect(onSaved).toHaveBeenCalledTimes(1)
  })
  const saved = useResumeStore.getState().resume
  expect(saved?.text).not.toContain('example.com')
  expect(saved?.text).toContain('[email removed]')
  expect(saved?.textHash).toMatch(/^[0-9a-f]{64}$/)
  expect(saved?.profile).toBeNull()
  expect(JSON.parse(localStorage.getItem('jw:resume') ?? 'null')).toMatchObject({
    state: { resume: { textHash: saved?.textHash } },
  })
})
