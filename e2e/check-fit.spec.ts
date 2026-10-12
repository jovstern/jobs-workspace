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
          advice: expect.objectContaining({ plans: expect.any(Array) }),
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

    // No required gap here, so that group is not rendered; one nice-to-have gap is.
    await expect(
      page.getByRole('heading', { level: 4, name: 'Nice-to-have gaps (1)' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { level: 4, name: /^Required gaps/ })).toHaveCount(0)

    await page.getByRole('button', { name: 'Senior Data Scientist' }).click()
    await page.getByRole('button', { name: 'Check my fit' }).click()

    await expect(page.getByText('Long shot', { exact: true })).toBeVisible()

    // The stand-in rates Senior Data Scientist with 6 required gaps (4 not evidenced, 2 partly
    // evidenced) and 2 nice-to-have gaps. Each required gap shows its learning plan open.
    await expect(page.getByRole('heading', { level: 3, name: 'Gaps' })).toBeVisible()
    const requiredGaps = page.getByRole('list', { name: 'Required gaps (6)' })
    await expect(page.getByRole('heading', { level: 4, name: 'Required gaps (6)' })).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 4, name: 'Nice-to-have gaps (2)' }),
    ).toBeVisible()
    await expect(requiredGaps.getByRole('listitem').first()).toBeVisible()
    await expect(requiredGaps.getByText('not evidenced in your resume').first()).toBeVisible()
    await expect(requiredGaps.getByText('What to learn').first()).toBeVisible()
    await expect(requiredGaps.getByText('Why it matters for this job').first()).toBeVisible()
    await expect(
      requiredGaps.getByText(/^Rough effort: (days|weeks|months)$/).first(),
    ).toBeVisible()

    // Partly evidenced requirements say so, and their plan covers only what is missing.
    await expect(requiredGaps.getByText('partly evidenced in your resume').first()).toBeVisible()
    await expect(
      requiredGaps.getByText('This plan covers only what your resume does not yet show.').first(),
    ).toBeVisible()

    // A nice-to-have plan starts closed and opens with one click.
    const niceGaps = page.getByRole('list', { name: 'Nice-to-have gaps (2)' })
    await expect(niceGaps.getByText('What to learn')).toHaveCount(0)
    await niceGaps
      .getByRole('button', { name: /^Show plan:/ })
      .first()
      .click()
    await expect(niceGaps.getByRole('button', { name: /^Hide plan:/ })).toHaveCount(1)
    await expect(niceGaps.getByText('What to learn')).toHaveCount(1)

    // The same check also brings tailoring tips: each points at a line already in the resume, and
    // the posting's words the resume lacks are chips under the honesty note.
    await expect(
      page.getByRole('heading', { level: 3, name: 'Tailoring your resume for this job' }),
    ).toBeVisible()
    await expect(
      page.getByText(
        'These tips only point at text that is already in your resume. Never add something that is not true.',
      ),
    ).toBeVisible()
    const tips = page.getByRole('list', { name: 'Emphasise what you already have' })
    await expect(tips.getByRole('listitem').first()).toContainText('From your resume:')
    await expect(page.getByText('Add only if true for you.', { exact: true })).toBeVisible()
    const chips = page.getByRole('list', {
      name: 'Words from the posting your resume does not use',
    })
    expect(await chips.getByRole('listitem').count()).toBeGreaterThanOrEqual(4)
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

    // The withdrawn rating leaves one gap with no plan; it says so once.
    await expect(
      page.getByText('No learning plan was generated for this one. Check again to try once more.'),
    ).toHaveCount(1)
  })

  test("a rate-limited check shows Google's message, and one Try again click is one retry @fake-only", async ({
    page,
    request,
  }) => {
    await saveResume(page)
    await request.post(`${STAND_IN}/__reset`)
    await request.post(`${STAND_IN}/__scenario`, { data: { name: 'http_429' } })

    await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()
    await page.getByRole('button', { name: 'Check my fit' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Could not check your fit')
    await expect(alert).toContainText("Google's AI is rate limiting this key.")
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible()

    await request.post(`${STAND_IN}/__scenario`, { data: { name: 'ok' } })
    await alert.getByRole('button', { name: 'Try again' }).click()

    await expect(page.getByText(BANDS)).toBeVisible()
    await expect(alert).toHaveCount(0)
    const count = await request.get(`${STAND_IN}/__count`)
    expect(await count.json()).toEqual({ generateContent: 2 })
  })

  test('a stopped app server is named as such, and Try again works once it answers @fake-only', async ({
    page,
    request,
  }) => {
    await saveResume(page)
    await request.post(`${STAND_IN}/__reset`)
    // The dev and preview proxy answers an empty 502 when the app server is down.
    await page.route('**/api/fit', (route) =>
      route.fulfill({ status: 502, contentType: 'text/plain', body: '' }),
    )

    await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()
    await page.getByRole('button', { name: 'Check my fit' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toContainText("Can't reach the app server (is it running?)")
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible()

    await page.unroute('**/api/fit')
    await alert.getByRole('button', { name: 'Try again' }).click()

    await expect(page.getByText(BANDS)).toBeVisible()
    await expect(alert).toHaveCount(0)
    const count = await request.get(`${STAND_IN}/__count`)
    expect(await count.json()).toEqual({ generateContent: 1 })
  })

  test('a refused page address gets its own message and no Try again @fake-only', async ({
    page,
    request,
  }) => {
    await saveResume(page)
    await request.post(`${STAND_IN}/__reset`)
    await page.route('**/api/fit', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'forbidden_origin', message: 'Server wording.', retryable: false },
        }),
      }),
    )

    await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()
    await page.getByRole('button', { name: 'Check my fit' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toContainText(
      "The app server refused this page's address. Open the app at http://localhost:5173 or set ALLOWED_ORIGINS.",
    )
    await expect(alert.getByRole('button', { name: 'Try again' })).toHaveCount(0)
    await expect(alert.getByRole('link')).toHaveCount(0)
    await expect(page.getByText('Server wording.')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Check my fit' })).toBeVisible()
    const count = await request.get(`${STAND_IN}/__count`)
    expect(await count.json()).toEqual({ generateContent: 0 })
  })

  test('a result saved before learning plans existed offers Check again, and one click adds them @fake-only', async ({
    page,
  }) => {
    let fitRequests = 0
    page.on('request', (request) => {
      if (request.url().endsWith('/api/fit')) fitRequests += 1
    })
    await saveResume(page)
    await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()
    await page.getByRole('button', { name: 'Check my fit' }).click()
    await expect(page.getByText('Strong fit', { exact: true })).toBeVisible()
    expect(fitRequests).toBe(1)

    // Make the saved result look like one from before learning plans existed.
    await page.evaluate(() => {
      const raw = window.localStorage.getItem('jw:analyses')
      const stored = JSON.parse(raw ?? 'null') as {
        state: { byJobId: Record<string, { advice: unknown }> }
      }
      const entry = stored.state.byJobId['job-frontend-senior']
      if (entry) entry.advice = null
      window.localStorage.setItem('jw:analyses', JSON.stringify(stored))
    })
    await page.reload()
    await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()

    // The saved result shows at once, with its score and a notice, and sends nothing.
    const notice = page
      .getByRole('status')
      .filter({ hasText: 'Learning plans and tailoring tips are new' })
    await expect(notice).toBeVisible()
    await expect(page.getByText('Strong fit', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Show plan:/ })).toHaveCount(0)
    expect(fitRequests).toBe(1)

    await notice.getByRole('button', { name: 'Check again to add learning plans and tips' }).click()

    await expect(page.getByRole('button', { name: /^Show plan:/ })).toHaveCount(1)
    await expect(notice).toHaveCount(0)
    await expect(page.getByText('Strong fit', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check again', exact: true })).toBeFocused()
    expect(fitRequests).toBe(2)
  })

  test('progress is shown while a slow check runs, then the result @fake-only', async ({
    page,
    request,
  }) => {
    await saveResume(page)
    await request.post(`${STAND_IN}/__scenario`, { data: { name: 'slow' } })

    await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()
    await page.getByRole('button', { name: 'Check my fit' }).click()

    await expect(page.getByText('Checking your fit', { exact: true })).toBeVisible()
    await expect(page.getByText('Reading your resume', { exact: true })).toBeVisible()
    await expect(page.getByText(/^Usually \d+ to \d+ seconds\.$/)).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Checking your fit' })).toBeVisible()

    await expect(page.getByText(BANDS)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('progressbar')).toHaveCount(0)
  })

  test('demo: gaps with learning plans and tips, a failed check recovered with Try again, and a storage notice above a working page @fake-only', async ({
    page,
    request,
  }) => {
    await saveResume(page)

    // 1. A check that leaves a next step: gaps, what to learn, and how to tailor the resume.
    await page.getByRole('button', { name: 'Senior Data Scientist' }).click()
    await page.getByRole('button', { name: 'Check my fit' }).click()

    await expect(page.getByRole('heading', { level: 4, name: 'Required gaps (6)' })).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 4, name: 'Nice-to-have gaps (2)' }),
    ).toBeVisible()
    await expect(page.getByText('What to learn').first()).toBeVisible()
    await expect(page.getByText(/^Rough effort: (days|weeks|months)$/).first()).toBeVisible()
    await page
      .getByRole('button', { name: /^Show plan:/ })
      .first()
      .click()
    await expect(page.getByRole('button', { name: /^Hide plan:/ })).toHaveCount(1)
    await expect(
      page.getByRole('heading', { level: 3, name: 'Tailoring your resume for this job' }),
    ).toBeVisible()
    await expect(page.getByText('Add only if true for you.', { exact: true })).toBeVisible()

    // 2. The AI is rate limited: the page says so, and one click recovers.
    await request.post(`${STAND_IN}/__scenario`, { data: { name: 'http_429' } })
    await page.getByRole('button', { name: 'Junior Frontend Developer' }).click()
    await page.getByRole('button', { name: 'Check my fit' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toContainText("Google's AI is rate limiting this key.")
    await request.post(`${STAND_IN}/__scenario`, { data: { name: 'ok' } })
    await alert.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByText(BANDS)).toBeVisible()
    await expect(alert).toHaveCount(0)

    // 3. Saved fit checks that cannot be read are set aside, with a notice above a working page.
    await page.evaluate(() => {
      window.localStorage.setItem('jw:analyses', '{broken')
    })
    await page.reload()

    const storageAlert = page.getByRole('alert')
    await expect(storageAlert).toContainText(
      'Your saved fit checks could not be read, so they were set aside.',
    )
    const alertBox = await storageAlert.boundingBox()
    const headingBox = await page.getByRole('heading', { level: 1 }).boundingBox()
    expect(alertBox?.y ?? Infinity).toBeLessThan(headingBox?.y ?? 0)
    await expect(page.getByText(/^Resume saved\. \d+ characters\.$/)).toBeVisible()

    await page.getByRole('button', { name: 'Senior Data Scientist' }).click()
    await expect(page.getByRole('button', { name: 'Check my fit' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 4, name: /^Required gaps/ })).toHaveCount(0)
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
