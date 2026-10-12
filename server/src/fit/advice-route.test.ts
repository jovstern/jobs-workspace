import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { fitResponseSchema } from '@jobs-workspace/shared'
import type { FitResponse } from '@jobs-workspace/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { createApp } from '../app'
import { createGeminiClient } from '../ai/client'
import { prepareResumeForModel } from '../ai/prepare'
import { startFakeGemini } from '../test-support/fake-gemini'
import type { FakeGemini } from '../test-support/fake-gemini'

import { containsLink } from './advice-text'
import { buildResumeIndex, normaliseForMatch, occursAsPhrase, verifyQuote } from './quotes'

const JOB_ID = 'job-frontend-senior'

// Synthetic resume only: an invented person, an invented employer.
const RESUME_A = [
  'Alex Sample, Frontend Engineer',
  'Built React single page applications for a logistics start-up over six years.',
  'Wrote TypeScript in strict mode across a shared component package.',
  'Ran accessibility audits and fixed keyboard navigation on the dispatch board.',
  'Added Playwright and Vitest tests to the checkout flow.',
  'Cut bundle size by thirty percent by splitting routes and tuning performance.',
].join('\n')

let fake: FakeGemini
let server: Server
let baseUrl: string

beforeAll(async () => {
  fake = await startFakeGemini()
  const ai = createGeminiClient({ apiKey: 'ci-fake-key', baseUrl: fake.url })
  const listening = createApp({ ai }).listen(0, '127.0.0.1')
  await new Promise((resolve) => listening.once('listening', resolve))
  server = listening
  baseUrl = `http://127.0.0.1:${String((listening.address() as AddressInfo).port)}`
})

afterAll(async () => {
  server.close()
  await fake.close()
})

beforeEach(() => {
  fake.reset()
})

async function fit(scenario: 'ok' | 'advice_partial'): Promise<FitResponse> {
  fake.reset()
  fake.setScenario(scenario)
  const response = await fetch(`${baseUrl}/api/fit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobId: JOB_ID, resumeText: RESUME_A }),
  })
  expect(response.status).toBe(200)
  return fitResponseSchema.parse(await response.json())
}

describe('defective plans through the real SDK, the stand-in and the route', () => {
  test('the ratings are the same as for a clean answer, with HTTP 200 and one upstream call', async () => {
    const clean = await fit('ok')
    const partial = await fit('advice_partial')

    expect(partial.ratings).toEqual(clean.ratings)
    expect(fake.requestCount()).toBe(1)
  })

  test('no returned step or why text carries a link', async () => {
    const { advice } = await fit('advice_partial')

    expect(advice?.plans.length).toBeGreaterThan(0)
    for (const plan of advice?.plans ?? []) {
      expect(plan.whyItMatters).not.toContain('example.com')
      for (const step of plan.steps) expect(step).not.toContain('example.com')
    }
  })

  test('only gaps have plans, once each, and a gap whose why text had a link has none', async () => {
    const body = await fit('advice_partial')
    const gapIds = body.ratings
      .filter((rating) => rating.rating !== 'met')
      .map((rating) => rating.requirementId)

    const planIds = (body.advice?.plans ?? []).map((plan) => plan.requirementId)
    for (const id of planIds) expect(gapIds).toContain(id)
    expect(new Set(planIds).size).toBe(planIds.length)
    expect(planIds).not.toContain('no-such-requirement')
    const [firstGap, secondGap] = gapIds
    expect(planIds).toContain(firstGap)
    expect(planIds).not.toContain(secondGap)
  })

  test('the first gap keeps exactly 4 steps of the six it was sent, without the link step', async () => {
    const body = await fit('advice_partial')
    const firstGap = body.ratings.find((rating) => rating.rating !== 'met')

    const plan = body.advice?.plans.find((entry) => entry.requirementId === firstGap?.requirementId)
    expect(plan?.steps).toHaveLength(4)
    expect(plan?.whyItMatters).not.toBe('A second plan for the same requirement.')
  })
})

describe('tailoring through the real SDK, the stand-in and the route', () => {
  const index = buildResumeIndex(prepareResumeForModel(RESUME_A))
  const resumeUses = (word: string) => {
    const phrase = normaliseForMatch(word)
    return occursAsPhrase(index.joined, phrase) || occursAsPhrase(index.separated, phrase)
  }

  test('a clean answer gives tailoring in which every tip quote is in the resume', async () => {
    const { advice } = await fit('ok')

    expect(advice?.tailoring).not.toBeNull()
    const tailoring = advice?.tailoring
    expect(tailoring?.emphasise.length).toBeGreaterThan(0)
    expect(tailoring?.emphasise.length).toBeLessThanOrEqual(5)
    for (const entry of tailoring?.emphasise ?? []) {
      expect(verifyQuote(entry.quote, index)).toBe(true)
    }
    expect(tailoring?.keywords.length).toBeLessThanOrEqual(8)
    for (const keyword of tailoring?.keywords ?? []) expect(resumeUses(keyword)).toBe(false)
  })

  test('a defective answer keeps exactly one tip, the real quote once, with no link in its advice', async () => {
    const { advice } = await fit('advice_partial')

    const tips = advice?.tailoring?.emphasise ?? []
    expect(tips).toHaveLength(1)
    expect(verifyQuote(tips[0]?.quote ?? '', index)).toBe(true)
    for (const tip of tips) expect(tip.advice).not.toContain('example.com')
  })

  test('a defective answer keeps only keywords that are new to the resume, without links or repeats', async () => {
    const { advice } = await fit('advice_partial')

    const keywords = advice?.tailoring?.keywords ?? []
    expect(keywords.map((keyword) => keyword.toLowerCase())).not.toContain('zyxwvut')
    for (const keyword of keywords) {
      expect(containsLink(keyword)).toBe(false)
      expect(resumeUses(keyword)).toBe(false)
    }
    expect(new Set(keywords.map((keyword) => keyword.toLowerCase())).size).toBe(keywords.length)
  })
})
