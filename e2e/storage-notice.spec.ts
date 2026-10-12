import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

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
