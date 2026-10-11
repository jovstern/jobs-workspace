import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

// Key material the browser must never receive: a Google API key shape, the fake key the browser
// tests give the server, and any VITE-prefixed key name (which Vite would inline into the bundle).
// The plain name GEMINI_API_KEY is allowed: the page's own set-up message says it.
const KEY_SHAPE = /AIza[0-9A-Za-z_-]{35}/
const FAKE_KEY = 'ci-fake-key'
const VITE_KEY_NAME = 'VITE_GEMINI'

const SCANNED_TYPES = new Set(['document', 'script', 'stylesheet', 'fetch', 'xhr'])

function findKeyMaterial(body: string): string[] {
  const found: string[] = []
  if (KEY_SHAPE.test(body)) found.push('a Google API key')
  if (body.includes(FAKE_KEY)) found.push(`the value ${FAKE_KEY}`)
  if (body.includes(VITE_KEY_NAME)) found.push(`the name ${VITE_KEY_NAME}`)
  return found
}

test('no document, script, stylesheet or API response the page loads contains key material', async ({
  page,
  request,
}) => {
  const bodies = new Map<string, { type: string; text: string }>()
  const pending: Promise<void>[] = []

  page.on('response', (response) => {
    const type = response.request().resourceType()
    if (!SCANNED_TYPES.has(type)) return
    pending.push(
      response.text().then(
        (text) => {
          bodies.set(response.url(), { type, text })
        },
        () => {
          // A response with no readable body (a redirect, an aborted request) has nothing to scan.
        },
      ),
    )
  })

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Senior Frontend Engineer' })).toBeVisible()
  // Selecting a job makes the page ask for the AI status, so /api/health is loaded as the page
  // itself loads it as well as through the request fixture below.
  await page.getByRole('button', { name: 'Senior Frontend Engineer' }).click()
  await expect(page.getByRole('button', { name: 'Check my fit' })).toBeVisible()
  await Promise.all(pending)

  // Guard against a vacuous pass: the scan must have seen the page, its code, its styles and data.
  const types = new Set([...bodies.values()].map((entry) => entry.type))
  for (const type of ['document', 'script', 'stylesheet', 'fetch']) {
    expect(types, `the page loaded no ${type} to scan`).toContain(type)
  }

  for (const [url, { text }] of bodies) {
    expect(findKeyMaterial(text), `key material in the response from ${url}`).toEqual([])
  }

  for (const path of ['/api/health', '/api/jobs']) {
    const response = await request.get(path)
    expect(response.ok(), `${path} answered ${String(response.status())}`).toBe(true)
    expect(findKeyMaterial(await response.text()), `key material in ${path}`).toEqual([])
  }
})

test('the env template lists GEMINI_API_KEY with no value', () => {
  const template = readFileSync(new URL('../server/.env.example', import.meta.url), 'utf8')

  expect(template).toMatch(/^GEMINI_API_KEY=$/m)
  expect(findKeyMaterial(template)).toEqual([])
})
