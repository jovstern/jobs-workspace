import { expect, test } from '@playwright/test'

// Synthetic resume: a fictional person with no contact details.
const RESUME = [
  'Alex Sample, Frontend Engineer',
  'Built React single page applications for a logistics start-up over six years.',
  'Wrote TypeScript in strict mode across a shared component package.',
  'Ran accessibility audits and fixed keyboard navigation on the dispatch board.',
  'Added Playwright and Vitest testing to the checkout flow.',
  'Cut bundle size by thirty percent with performance work on route splitting.',
  'Maintained a design system used by three product teams.',
].join('\n')

test('main flow: enter resume, check fit, refresh keeps the result', async ({ page }) => {
  let fitRequests = 0
  page.on('request', (request) => {
    if (request.url().endsWith('/api/fit')) fitRequests += 1
  })

  await page.goto('/')
  await page.getByLabel('Resume text').fill(RESUME)
  await page.getByRole('button', { name: 'Use this text' }).click()
  await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()

  // Loading the page and selecting a job never start an AI request.
  expect(fitRequests).toBe(0)

  await page.getByRole('button', { name: 'Check my fit' }).click()

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
  await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()

  await expect(ratings.getByRole('listitem')).toHaveCount(8)
  expect(fitRequests).toBe(1)
})
