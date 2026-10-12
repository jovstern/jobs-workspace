import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Synthetic resume: a fictional person, as in check-fit.spec.ts.
const RESUME = readFileSync(
  new URL('./fixtures/resumes/frontend-senior.txt', import.meta.url),
  'utf8',
)

// A saved result in the shape Phase 1 wrote (advice null), built with every field the stored
// schema requires.
const SAVED_ANALYSIS = {
  jobId: 'job-frontend-senior',
  jobContentVersion: 'v1',
  model: 'stand-in',
  promptVersion: 'p1',
  schemaVersion: 1,
  analysedAt: '2026-10-11T10:00:00.000Z',
  ratings: [],
  advice: null,
  resumeHash: 'a'.repeat(64),
}

// None of these tests may call the fit route: the stand-in model's scenario is shared with
// check-fit.spec.ts, which runs in parallel.
function countFitRequests(page: Page) {
  const counter = { count: 0 }
  page.on('request', (request) => {
    if (request.url().endsWith('/api/fit')) counter.count += 1
  })
  return counter
}

test('unreadable saved fit checks are set aside with a notice, and the page still works', async ({
  page,
}) => {
  const fit = countFitRequests(page)
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.setItem('jw:analyses', '{broken')
  })
  await page.reload()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText(
    'Your saved fit checks could not be read, so they were set aside. Run Check my fit again to rebuild them. A copy is kept in this browser.',
  )
  await expect(alert).toContainText('A copy is kept in this browser.')

  // The notice is the first thing on the page, above the header.
  const alertBox = await alert.boundingBox()
  const headingBox = await page.getByRole('heading', { level: 1 }).boundingBox()
  expect(alertBox).not.toBeNull()
  expect(headingBox).not.toBeNull()
  expect(alertBox?.y ?? 0).toBeLessThan(headingBox?.y ?? 0)

  // The page works as on a first visit.
  await expect(page.getByLabel('Paste your resume text')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Senior Frontend Engineer' })).toBeVisible()

  const stored = await page.evaluate(() => {
    const keys = Object.keys(window.localStorage).filter((key) =>
      key.startsWith('jw:analyses:corrupt:'),
    )
    return {
      copies: keys.map((key) => window.localStorage.getItem(key)),
      original: window.localStorage.getItem('jw:analyses'),
    }
  })
  expect(stored.copies).toEqual(['{broken'])
  expect(stored.original).toBeNull()

  await alert.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()

  await page.reload()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(fit.count).toBe(0)
})

test('an unreadable saved resume is set aside and the paste form is back', async ({ page }) => {
  const fit = countFitRequests(page)
  await page.goto('/')
  await page.getByLabel('Paste your resume text').fill(RESUME)
  await page.getByRole('button', { name: 'Review text' }).click()
  await page.getByRole('button', { name: 'Save resume' }).click()
  await expect(page.getByText('Resume saved.', { exact: true })).toBeAttached()

  await page.evaluate(() => {
    window.localStorage.setItem('jw:resume', '[1,2,3]')
  })
  await page.reload()

  await expect(page.getByRole('alert')).toContainText(
    'Your saved resume could not be read, so it was set aside and the page started without it. Add your resume again to continue. A copy is kept in this browser.',
  )
  await expect(page.getByLabel('Paste your resume text')).toBeVisible()
  expect(fit.count).toBe(0)
})

test('one unreadable saved fit check is set aside and the others stay', async ({ page }) => {
  const fit = countFitRequests(page)
  await page.goto('/')
  await page.evaluate((analysis) => {
    window.localStorage.setItem(
      'jw:analyses',
      JSON.stringify({
        state: {
          byJobId: { 'job-frontend-senior': analysis, 'job-backend-mid': { broken: true } },
        },
        version: 1,
      }),
    )
  }, SAVED_ANALYSIS)
  await page.reload()

  await expect(page.getByRole('alert')).toContainText(
    '1 saved fit check could not be read and was set aside. The others are fine. A copy is kept in this browser.',
  )
  const stored = await page.evaluate(() => window.localStorage.getItem('jw:analyses'))
  const parsed = JSON.parse(stored ?? 'null') as { state: { byJobId: Record<string, unknown> } }
  expect(Object.keys(parsed.state.byJobId)).toEqual(['job-frontend-senior'])
  expect(fit.count).toBe(0)
})

test('saved fit checks from a newer version are set aside with a notice', async ({ page }) => {
  const fit = countFitRequests(page)
  await page.goto('/')
  await page.evaluate((analysis) => {
    window.localStorage.setItem(
      'jw:analyses',
      JSON.stringify({ state: { byJobId: { 'job-frontend-senior': analysis } }, version: 99 }),
    )
  }, SAVED_ANALYSIS)
  await page.reload()

  await expect(page.getByRole('alert')).toContainText('written by a newer version of this app')
  await expect(page.getByLabel('Paste your resume text')).toBeVisible()
  expect(fit.count).toBe(0)
})

test('a result saved in Phase 1 shape loads with no notice', async ({ page }) => {
  const fit = countFitRequests(page)
  await page.goto('/')
  await page.evaluate((analysis) => {
    window.localStorage.setItem(
      'jw:analyses',
      JSON.stringify({ state: { byJobId: { 'job-frontend-senior': analysis } }, version: 1 }),
    )
  }, SAVED_ANALYSIS)
  await page.reload()

  await expect(page.getByRole('button', { name: 'Senior Frontend Engineer' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(fit.count).toBe(0)
})
