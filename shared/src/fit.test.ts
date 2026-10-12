import { describe, expect, test } from 'vitest'

import {
  adviceSchema,
  EFFORTS,
  FIT_SCHEMA_VERSION,
  fitResponseSchema,
  learningPlanSchema,
} from './fit'
import { indexRatingsFirstWins } from './fit/score'

const RATING = {
  requirementId: 'r1',
  rating: 'met',
  quote: 'Built React single page applications for a logistics start-up.',
  rationale: 'Shown in the resume.',
  quoteRejected: false,
} as const

function response(overrides: Record<string, unknown>) {
  return {
    jobId: 'job-1',
    jobContentVersion: 'v1',
    model: 'a-model',
    promptVersion: 'fit-ratings-1',
    schemaVersion: FIT_SCHEMA_VERSION,
    analysedAt: '2026-10-11T09:30:00.000Z',
    ratings: [RATING],
    advice: null,
    ...overrides,
  }
}

function plan(overrides: Record<string, unknown> = {}) {
  return {
    requirementId: 'r2',
    steps: ['Read the official guide', 'Build a small example'],
    whyItMatters: 'The role runs this every day.',
    effort: 'weeks',
    ...overrides,
  }
}

describe('the stored shape of advice', () => {
  test('a result stored before advice existed still validates, and the schema version stays 1', () => {
    const stored = response({ advice: null, promptVersion: 'fit-ratings-1' })

    expect(fitResponseSchema.safeParse(stored).success).toBe(true)
    expect(FIT_SCHEMA_VERSION).toBe(1)
  })

  test('a full advice object validates', () => {
    const advice = {
      plans: [plan()],
      tailoring: {
        emphasise: [{ quote: 'Wrote TypeScript in strict mode.', advice: 'Move this line up.' }],
        keywords: ['Kubernetes'],
      },
    }

    expect(fitResponseSchema.safeParse(response({ advice })).success).toBe(true)
  })

  test('empty plans with no tailoring validates', () => {
    expect(adviceSchema.safeParse({ plans: [], tailoring: null }).success).toBe(true)
  })
})

describe('the limits on advice', () => {
  test.each([
    ['no steps', plan({ steps: [] })],
    ['five steps', plan({ steps: ['a', 'b', 'c', 'd', 'e'] })],
    ['an effort outside days, weeks or months', plan({ effort: 'years' })],
  ])('rejects a plan with %s', (_name, candidate) => {
    expect(learningPlanSchema.safeParse(candidate).success).toBe(false)
  })

  test('accepts every effort in EFFORTS', () => {
    for (const effort of EFFORTS) {
      expect(learningPlanSchema.safeParse(plan({ effort })).success).toBe(true)
    }
  })

  test('rejects six tips', () => {
    const tip = { quote: 'Wrote TypeScript in strict mode.', advice: 'Move this line up.' }

    const result = adviceSchema.safeParse({
      plans: [],
      tailoring: { emphasise: Array.from({ length: 6 }, () => tip), keywords: [] },
    })

    expect(result.success).toBe(false)
  })

  test('rejects nine keywords', () => {
    const result = adviceSchema.safeParse({
      plans: [],
      tailoring: {
        emphasise: [],
        keywords: Array.from({ length: 9 }, (_unused, index) => `keyword ${String(index)}`),
      },
    })

    expect(result.success).toBe(false)
  })
})

describe('two plans for one requirement', () => {
  test('reading by requirement id returns the first', () => {
    const first = plan({ requirementId: 'r2', whyItMatters: 'first' })
    const second = plan({ requirementId: 'r2', whyItMatters: 'second' })

    const found = indexRatingsFirstWins([first, second]).get('r2')

    expect(found?.whyItMatters).toBe('first')
  })
})
