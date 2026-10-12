import { adviceSchema } from '@jobs-workspace/shared'
import type { Job, RatedRequirement } from '@jobs-workspace/shared'
import { describe, expect, test } from 'vitest'

import { buildAdvice } from './advice'
import { buildResumeIndex } from './quotes'

// Synthetic data only: an invented posting and an invented resume.
const JOB: Job = {
  id: 'job-test',
  title: 'Platform Engineer',
  company: 'Examplia Works',
  level: 'Mid',
  location: 'Remote',
  summary: ['Examplia Works runs small platforms.'],
  requirements: [
    { id: 'r1', kind: 'required', skill: 'React', text: 'Build interfaces with React.' },
    { id: 'r2', kind: 'required', skill: 'Testing', text: 'Write automated tests.' },
    { id: 'r3', kind: 'required', skill: 'GraphQL', text: 'Consume GraphQL APIs.' },
    { id: 'r4', kind: 'required', skill: 'Docker', text: 'Package services with Docker.' },
    { id: 'r5', kind: 'nice_to_have', skill: 'Mentoring', text: 'Mentor other engineers.' },
    { id: 'r6', kind: 'nice_to_have', skill: 'Agile', text: 'Work in sprints.' },
  ],
  contentVersion: 'test-1',
}

const RESUME = 'Built React apps for a logistics start-up.\nWrote unit tests for the checkout flow.'
const INDEX = buildResumeIndex(RESUME)

function rated(requirementId: string, rating: RatedRequirement['rating']): RatedRequirement {
  return { requirementId, rating, quote: null, rationale: 'Test.', quoteRejected: false }
}

// r1 and r2 are met; r3 to r6 are gaps.
const RATINGS: RatedRequirement[] = [
  rated('r1', 'met'),
  rated('r2', 'met'),
  rated('r3', 'not_evidenced'),
  rated('r4', 'partial'),
  rated('r5', 'not_evidenced'),
  rated('r6', 'not_evidenced'),
]

function plan(requirementId: string, overrides: Record<string, unknown> = {}): unknown {
  return {
    requirementId,
    steps: ['Read the official guide.', 'Build a small example.'],
    whyItMatters: 'The role asks for it.',
    effort: 'weeks',
    ...overrides,
  }
}

function run(rawPlans: unknown, rawTailoring: unknown = null) {
  return buildAdvice({ rawPlans, rawTailoring, job: JOB, ratings: RATINGS, index: INDEX })
}

describe('plan steps', () => {
  test('a step with a link is dropped and the other steps of the plan are kept', () => {
    const { advice, stats } = run([
      plan('r3', {
        steps: ['See https://example.com/course for an introduction', 'a', 'b', 'c', 'd', 'e'],
      }),
    ])

    expect(advice.plans).toHaveLength(1)
    expect(advice.plans[0]?.steps).toEqual(['a', 'b', 'c', 'd'])
    expect(stats.stepsDropped).toBe(1)
  })

  test('a plan with more than 4 usable steps keeps the first 4', () => {
    const { advice } = run([plan('r3', { steps: ['a', 'b', 'c', 'd', 'e', 'f'] })])

    expect(advice.plans[0]?.steps).toEqual(['a', 'b', 'c', 'd'])
  })

  test('a plan with one usable step is kept with that one step', () => {
    const { advice } = run([plan('r3', { steps: ['https://example.com', 'Only this step'] })])

    expect(advice.plans[0]?.steps).toEqual(['Only this step'])
  })

  test('a plan whose steps are all unusable is dropped', () => {
    const { advice } = run([plan('r3', { steps: ['', 'www.example.com', '   '] })])

    expect(advice.plans).toEqual([])
  })

  test('a step that is empty, too long, not a string or names a learning platform is dropped', () => {
    const { advice } = run([
      plan('r3', {
        steps: ['   ', 'x'.repeat(201), 42, null, 'Take a Udemy course', 'Keep this one'],
      }),
    ])

    expect(advice.plans[0]?.steps).toEqual(['Keep this one'])
  })

  test('kept steps are returned as received apart from surrounding whitespace', () => {
    const { advice } = run([plan('r3', { steps: ['  Read the guide, then try it.  '] })])

    expect(advice.plans[0]?.steps).toEqual(['Read the guide, then try it.'])
  })

  test('a step is never edited to remove a link from inside it', () => {
    const { advice } = run([
      plan('r3', { steps: ['Read https://example.com first', 'Plain step'] }),
    ])

    expect(advice.plans[0]?.steps).toEqual(['Plain step'])
  })
})

describe('plan fields', () => {
  test('a plan whose why text is empty, too long or has a link is dropped', () => {
    for (const whyItMatters of ['   ', 'w'.repeat(401), 'See www.example.com', 'Ask on Coursera']) {
      expect(run([plan('r3', { whyItMatters })]).advice.plans).toEqual([])
    }
  })

  test('a plan whose effort is not days, weeks or months is dropped', () => {
    expect(run([plan('r3', { effort: 'years' })]).advice.plans).toEqual([])
    expect(run([plan('r3', { effort: 3 })]).advice.plans).toEqual([])
  })

  test('a plan whose steps is not an array is dropped', () => {
    expect(run([plan('r3', { steps: 'read the guide' })]).advice.plans).toEqual([])
  })

  test('why text is returned as received apart from surrounding whitespace', () => {
    const { advice } = run([plan('r3', { whyItMatters: '  The role asks for it.  ' })])

    expect(advice.plans[0]?.whyItMatters).toBe('The role asks for it.')
  })
})

describe('which plans are kept', () => {
  test('of two plans for one requirement the first that survives is kept', () => {
    const { advice } = run([
      plan('r3', { whyItMatters: 'See www.example.com' }),
      plan('r3', { whyItMatters: 'Second plan survives.' }),
      plan('r3', { whyItMatters: 'Third plan is ignored.' }),
    ])

    expect(advice.plans).toHaveLength(1)
    expect(advice.plans[0]?.whyItMatters).toBe('Second plan survives.')
  })

  test('no plan is kept for a met requirement or for an unknown id', () => {
    const { advice } = run([plan('r1'), plan('no-such-requirement'), plan('r4')])

    expect(advice.plans.map((entry) => entry.requirementId)).toEqual(['r4'])
  })

  test('plans come out in the posting sequence', () => {
    const { advice } = run([plan('r6'), plan('r3'), plan('r5')])

    expect(advice.plans.map((entry) => entry.requirementId)).toEqual(['r3', 'r5', 'r6'])
  })

  test('plans that are not an array give no plans', () => {
    expect(run('not a list').advice).toEqual({ plans: [], tailoring: null })
    expect(run(undefined).advice).toEqual({ plans: [], tailoring: null })
  })

  test('items that are not objects are ignored', () => {
    const { advice } = run([null, 7, 'text', [], plan('r3')])

    expect(advice.plans).toHaveLength(1)
  })
})

describe('junk input', () => {
  function junk(seed: number): unknown {
    const pool: unknown[] = [
      0,
      -1,
      NaN,
      'text',
      '',
      null,
      undefined,
      true,
      [],
      {},
      ['x', 1, null],
      { requirementId: 'r3' },
      { requirementId: 'r3', steps: [1, 2], whyItMatters: 3, effort: {} },
      [[[]], { a: { b: [] } }],
    ]
    const pick = (offset: number) => pool[(seed * 7 + offset * 3) % pool.length]
    return seed % 5 === 0
      ? pick(0)
      : [pick(0), pick(1), { requirementId: pick(2), steps: pick(3), whyItMatters: pick(4) }]
  }

  test('200 random junk inputs give schema-valid advice and never throw', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const result = run(junk(seed), junk(seed + 1))
      expect(adviceSchema.safeParse(result.advice).success).toBe(true)
    }
  })
})
