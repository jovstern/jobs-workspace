import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Synthetic resume: a fictional person. Every contact detail in it is invented (example.com, the
// 555 01xx phone range, a street that does not exist) and is removed before anything is saved.
const RESUME = readFileSync(
  new URL('./fixtures/resumes/frontend-senior.txt', import.meta.url),
  'utf8',
)

// The stand-in model's control endpoints (port 3199). Only the fake-only tests below use them.
const STAND_IN = 'http://127.0.0.1:3199'
const BANDS = /^(Strong fit|Good fit|Stretch|Long shot)$/

async function saveResume(page: Page) {
  await page.goto('/')
  await page.getByLabel('Paste your resume text').fill(RESUME)
  await page.getByRole('button', { name: 'Review text' }).click()
  await page.getByRole('button', { name: 'Save resume' }).click()
  await expect(page.getByText('Resume saved.', { exact: true })).toBeAttached()
}

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

  const required = page.getByRole('list', { name: 'Required', exact: true })
  const niceToHave = page.getByRole('list', { name: 'Nice to have', exact: true })
  await expect(required.getByRole('listitem')).toHaveCount(6)
  await expect(niceToHave.getByRole('listitem')).toHaveCount(2)
  await expect(required.getByText('Met', { exact: true }).first()).toBeVisible()
  await expect(required.getByText('From your resume:').first()).toBeVisible()

  // The score and band are computed in the browser from the ratings: assert the shape, not the
  // numbers, so the same test also runs against the real model.
  const percentage = page.getByText(/^\d{1,3}%$/)
  await expect(percentage).toBeVisible()
  await expect(page.getByText(BANDS)).toBeVisible()
  await expect(page.getByText('Fit estimate', { exact: true })).toBeVisible()
  await expect(page.getByText(/^\d+ of 6 required requirements met$/)).toBeVisible()
  await expect(page.getByText(/not a verdict on whether to apply/)).toBeVisible()
  const scoreText = await percentage.innerText()
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

  // The stored result appears at once, with the same score, and no new request was made.
  await expect(required.getByRole('listitem')).toHaveCount(6)
  await expect(niceToHave.getByRole('listitem')).toHaveCount(2)
  await expect(page.getByText(/^\d{1,3}%$/)).toHaveText(scoreText)
  expect(fitRequests).toBe(1)
})

// These tests need the stand-in model: they pin exact outcomes and switch scenarios. Every fit
// call in this file runs serially, which also keeps it under the server's rate limit.
test.describe('with the stand-in model', () => {
  test.afterEach(async ({ request }) => {
    await request.post(`${STAND_IN}/__reset`)
  })

  test('a strong match and a poor match get their bands @fake-only', async ({ page }) => {
    await saveResume(page)

    await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()
    await page.getByRole('button', { name: 'Check my fit' }).click()

    await expect(page.getByText('Strong fit', { exact: true })).toBeVisible()
    await expect(page.getByText('6 of 6 required requirements met')).toBeVisible()

    await page.getByRole('button', { name: 'Senior Data Scientist' }).click()
    await page.getByRole('button', { name: 'Check my fit' }).click()

    await expect(page.getByText('Long shot', { exact: true })).toBeVisible()
  })

  test('a quote the resume does not contain is shown as not evidenced @fake-only', async ({
    page,
    request,
  }) => {
    await saveResume(page)
    await request.post(`${STAND_IN}/__scenario`, { data: { name: 'hallucinated_quote' } })

    await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()
    await page.getByRole('button', { name: 'Check my fit' }).click()

    await expect(
      page.getByText(
        'The AI cited text we could not find in your resume, so this was marked not evidenced.',
      ),
    ).toHaveCount(1)
  })

  test('a failed check can be retried with one click, and each click is one request @fake-only', async ({
    page,
    request,
  }) => {
    await saveResume(page)
    await request.post(`${STAND_IN}/__reset`)
    await request.post(`${STAND_IN}/__scenario`, { data: { name: 'http_503' } })

    await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()
    await page.getByRole('button', { name: 'Check my fit' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Something went wrong on our side. Try again.')
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible()

    await request.post(`${STAND_IN}/__scenario`, { data: { name: 'ok' } })
    await alert.getByRole('button', { name: 'Try again' }).click()

    await expect(page.getByText(BANDS)).toBeVisible()
    await expect(alert).toHaveCount(0)
    const count = await request.get(`${STAND_IN}/__count`)
    expect(await count.json()).toEqual({ generateContent: 2 })
  })
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
