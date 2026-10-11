import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

// Synthetic resume: a fictional person. Every contact detail in it is invented (example.com, the
// 555 01xx phone range, a street that does not exist) and is removed before anything is saved.
const RESUME = readFileSync(
  new URL('./fixtures/resumes/frontend-senior.txt', import.meta.url),
  'utf8',
)

test('main flow: paste resume, remove contact details, check fit, refresh keeps both', async ({
  page,
}) => {
  let fitRequests = 0
  page.on('request', (request) => {
    if (request.url().endsWith('/api/fit')) fitRequests += 1
  })

  await page.goto('/')
  await page.getByLabel('Paste your resume text').fill(RESUME)
  await page.getByRole('button', { name: 'Review text' }).click()

  // The user sees what was removed, and the text in the box is already free of it.
  const notice = page.getByRole('status').filter({ hasText: 'Removed before anything is sent' })
  await expect(notice).toContainText('1 email address')
  await expect(notice).toContainText('1 phone number')
  await expect(notice).toContainText('1 street address')
  await expect(notice).toContainText('1 link')
  const field = page.getByLabel('Paste your resume text')
  await expect(field).toHaveValue(/\[email removed\]/)
  await expect(field).not.toHaveValue(/example\.com/)

  await page.getByRole('button', { name: 'Save resume' }).click()
  await expect(page.getByText('Resume saved.', { exact: true })).toBeAttached()
  await expect(page.getByText(/^Resume saved\. \d+ characters\.$/)).toBeVisible()

  await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()

  // Loading the page, saving a resume and selecting a job never start an AI request.
  expect(fitRequests).toBe(0)

  const fitRequest = page.waitForRequest((request) => request.url().endsWith('/api/fit'))
  await page.getByRole('button', { name: 'Check my fit' }).click()

  // The text that leaves the browser is the saved, contact-free text.
  const body = (await fitRequest).postData() ?? ''
  const sent = (JSON.parse(body) as { resumeText: string }).resumeText
  expect(sent).toContain('[email removed]')
  expect(sent).not.toContain('example.com')
  expect(sent).not.toContain('555 0142')

  const ratings = page.getByRole('list', { name: 'Rated requirements' })
  await expect(ratings.getByRole('listitem')).toHaveCount(8)
  await expect(ratings.getByText('Met', { exact: true }).first()).toBeVisible()
  await expect(ratings.getByText('From your resume:').first()).toBeVisible()
  expect(fitRequests).toBe(1)

  const stored = await page.evaluate(() => window.localStorage.getItem('jw:analyses'))
  expect(stored).not.toBeNull()
  const parsed: unknown = JSON.parse(stored ?? 'null')
  expect(parsed).toMatchObject({
    version: 1,
    state: {
      byJobId: {
        'job-frontend-senior': {
          advice: null,
          resumeHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
      },
    },
  })

  await page.reload()

  // The saved resume is still there, so the form is gone and the saved line is shown.
  await expect(page.getByText(/^Resume saved\. \d+ characters\.$/)).toBeVisible()
  await expect(page.getByLabel('Paste your resume text')).toHaveCount(0)

  await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()

  await expect(ratings.getByRole('listitem')).toHaveCount(8)
  expect(fitRequests).toBe(1)
})

test('a paste that is too short is refused and saves nothing, even after a reload', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Paste your resume text').fill('Twenty characters!!!')
  await page.getByRole('button', { name: 'Review text' }).click()

  await expect(page.getByRole('alert')).toHaveText('Paste at least 50 characters of resume text.')

  await page.reload()

  await expect(page.getByText('No resume yet')).toBeVisible()
  await expect(page.getByLabel('Paste your resume text')).toBeVisible()
  const stored = await page.evaluate(() => window.localStorage.getItem('jw:resume'))
  const state: unknown = stored === null ? null : JSON.parse(stored)
  expect(state === null || (state as { state: { resume: unknown } }).state.resume === null).toBe(
    true,
  )
})
