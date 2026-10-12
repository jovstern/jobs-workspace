import { describe, expect, test } from 'vitest'

import { MODELS } from './models'

// The browser gives up on a request after 60 seconds (DEFAULT_TIMEOUT_MS in src/lib/api.ts). The
// server must always answer first, with its own clear error, so the deadline stays below it.
const BROWSER_TIMEOUT_MS = 60000

describe('the fit model configuration', () => {
  test('leaves room for ratings, plans and tailoring: the output cap is at least 8192 tokens', () => {
    expect(MODELS.fit.maxOutputTokens).toBeGreaterThanOrEqual(8192)
  })

  test('waits at least 45 seconds but less than the browser 60 second timeout', () => {
    expect(MODELS.fit.deadlineMs).toBeGreaterThanOrEqual(45000)
    expect(MODELS.fit.deadlineMs).toBeLessThan(BROWSER_TIMEOUT_MS)
  })

  test('keeps a model id and one of the known thinking levels', () => {
    expect(MODELS.fit.id.length).toBeGreaterThan(0)
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(MODELS.fit.thinking)
  })
})
