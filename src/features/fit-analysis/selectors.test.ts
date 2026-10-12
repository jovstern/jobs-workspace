import type { Job, LearningPlan, StoredAnalysis } from '@jobs-workspace/shared'
import { describe, expect, test } from 'vitest'

import { buildFitView, selectCurrentAnalysis } from './selectors'

const HASH = 'a'.repeat(64)

const JOB: Job = {
  id: 'job-test',
  title: 'Test Engineer',
  company: 'Fictional Co',
  level: 'Mid',
  location: 'Remote',
  summary: ['A test job.'],
  requirements: [
    { id: 'r1', kind: 'required', skill: 'React', text: 'Required one' },
    { id: 'n1', kind: 'nice_to_have', skill: 'GraphQL', text: 'Nice one' },
    { id: 'r2', kind: 'required', skill: 'TypeScript', text: 'Required two' },
    { id: 'r3', kind: 'required', skill: 'Testing', text: 'Required three' },
    { id: 'n2', kind: 'nice_to_have', skill: 'Docker', text: 'Nice two' },
    { id: 'r4', kind: 'required', skill: 'Accessibility', text: 'Required four' },
  ],
  contentVersion: 'v1',
}

function analysis(overrides: Partial<StoredAnalysis> = {}): StoredAnalysis {
  return {
    jobId: JOB.id,
    jobContentVersion: 'v1',
    model: 'stand-in',
    promptVersion: 'p1',
    schemaVersion: 1,
    analysedAt: '2026-10-11T10:00:00.000Z',
    ratings: [
      {
        requirementId: 'n2',
        rating: 'partial',
        quote: 'docker',
        rationale: 'Some.',
        quoteRejected: false,
      },
      {
        requirementId: 'r1',
        rating: 'met',
        quote: 'react',
        rationale: 'Yes.',
        quoteRejected: false,
      },
      {
        requirementId: 'r2',
        rating: 'met',
        quote: 'typescript',
        rationale: 'Yes.',
        quoteRejected: false,
      },
      {
        requirementId: 'r4',
        rating: 'not_evidenced',
        quote: null,
        rationale: '',
        quoteRejected: true,
      },
    ],
    advice: null,
    resumeHash: HASH,
    ...overrides,
  }
}

describe('selectCurrentAnalysis', () => {
  test('returns the stored analysis when the resume hash and job version match', () => {
    const stored = analysis()
    expect(selectCurrentAnalysis({ [JOB.id]: stored }, JOB, HASH)).toBe(stored)
  })

  test('returns null when there is no resume', () => {
    expect(selectCurrentAnalysis({ [JOB.id]: analysis() }, JOB, null)).toBeNull()
  })

  test('returns null when nothing is stored for the job', () => {
    expect(selectCurrentAnalysis({}, JOB, HASH)).toBeNull()
  })

  test('returns null when the resume hash differs', () => {
    expect(selectCurrentAnalysis({ [JOB.id]: analysis() }, JOB, 'b'.repeat(64))).toBeNull()
  })

  test('returns null when the job content version differs', () => {
    const stored = analysis({ jobContentVersion: 'older' })
    expect(selectCurrentAnalysis({ [JOB.id]: stored }, JOB, HASH)).toBeNull()
  })
})

describe('buildFitView', () => {
  test('groups requirements in posting order and joins each with its rating', () => {
    const view = buildFitView(JOB, analysis())

    expect(view.required.map((item) => item.requirement.id)).toEqual(['r1', 'r2', 'r3', 'r4'])
    expect(view.niceToHave.map((item) => item.requirement.id)).toEqual(['n1', 'n2'])
    expect(view.required[0]).toMatchObject({ rating: 'met', quote: 'react', rationale: 'Yes.' })
    expect(view.niceToHave[1]).toMatchObject({ rating: 'partial', quote: 'docker' })
    expect(view.required[3]).toMatchObject({ rating: 'not_evidenced', quoteRejected: true })
  })

  test('a requirement with no rating is not evidenced', () => {
    const view = buildFitView(JOB, analysis())

    expect(view.required[2]).toMatchObject({
      rating: 'not_evidenced',
      quote: null,
      rationale: '',
      quoteRejected: false,
    })
    expect(view.niceToHave[0]?.rating).toBe('not_evidenced')
  })

  test('carries the score, band and required count computed from the ratings', () => {
    const view = buildFitView(JOB, analysis())

    // Required: 2 met of 4 -> 0.5; nice: partial + none -> 0.25. 100 x 0.5 x 0.925 = 46.25 -> 46.
    expect(view).toMatchObject({ score: 46, band: 'Stretch', requiredMet: 2, requiredTotal: 4 })
  })

  test('recomputes the score from the ratings every time, never reading a stored one', () => {
    const tampered = { ...analysis(), score: 100, band: 'Strong fit' }
    const view = buildFitView(JOB, tampered)

    expect(view.score).toBe(46)
    expect(view.band).toBe('Stretch')
  })

  describe('duplicate rating rows in stored data', () => {
    const duplicated = analysis({
      ratings: [
        {
          requirementId: 'r1',
          rating: 'met',
          quote: 'first',
          rationale: 'A.',
          quoteRejected: false,
        },
        {
          requirementId: 'r1',
          rating: 'not_evidenced',
          quote: null,
          rationale: 'B.',
          quoteRejected: false,
        },
        { requirementId: 'r2', rating: 'met', quote: 'two', rationale: 'C.', quoteRejected: false },
      ],
    })

    test('the first row for an id is the one shown', () => {
      const view = buildFitView(JOB, duplicated)

      expect(view.required[0]).toMatchObject({ rating: 'met', quote: 'first', rationale: 'A.' })
    })

    test('the displayed ratings and the computed score use the same row', () => {
      const view = buildFitView(JOB, duplicated)

      // r1 and r2 are met (first row wins), r3 and r4 have no row, no nice-to-have is met:
      // 100 x 0.5 x 0.9 = 45.
      const metShown = view.required.filter((item) => item.rating === 'met').length
      expect(metShown).toBe(2)
      expect(view.requiredMet).toBe(metShown)
      expect(view).toMatchObject({ score: 45, band: 'Stretch' })
    })
  })
})

const PLAN_N1: LearningPlan = {
  requirementId: 'n1',
  steps: ['Step one', 'Step two'],
  whyItMatters: 'Why n1.',
  effort: 'days',
}
const PLAN_R3: LearningPlan = {
  requirementId: 'r3',
  steps: ['Learn testing'],
  whyItMatters: 'Why r3.',
  effort: 'weeks',
}
const PLAN_R1: LearningPlan = {
  requirementId: 'r1',
  steps: ['Already met'],
  whyItMatters: 'Why r1.',
  effort: 'months',
}

function withAdvice(plans: LearningPlan[]): StoredAnalysis {
  return analysis({ advice: { plans, tailoring: null } })
}

describe('gaps in the view', () => {
  test('a gap is any requirement not rated met, in posting order, split by kind', () => {
    // r1 and r2 are met; r3 and r4 (required) and n1 and n2 (nice to have) are gaps. The stored
    // ratings are in another order than the posting.
    const view = buildFitView(JOB, analysis())

    expect(view.gaps.required.map((gap) => gap.requirement.id)).toEqual(['r3', 'r4'])
    expect(view.gaps.niceToHave.map((gap) => gap.requirement.id)).toEqual(['n1', 'n2'])
  })

  test('a gap carries its rating, quote and rationale from the same row as the item', () => {
    const view = buildFitView(JOB, analysis())

    expect(view.gaps.niceToHave[1]).toMatchObject({ rating: 'partial', quote: 'docker' })
    expect(view.gaps.required[1]).toMatchObject({ rating: 'not_evidenced', quoteRejected: true })
  })

  test('a plan is attached to its gap and a gap without a plan has plan null', () => {
    const view = buildFitView(JOB, withAdvice([PLAN_N1, PLAN_R3]))

    expect(view.gaps.required[0]?.plan).toEqual(PLAN_R3)
    expect(view.gaps.required[1]?.plan).toBeNull()
    expect(view.gaps.niceToHave[0]?.plan).toEqual(PLAN_N1)
    expect(view.gaps.niceToHave[1]?.plan).toBeNull()
  })

  test('a plan stored for a requirement rated met is not attached to anything', () => {
    const view = buildFitView(JOB, withAdvice([PLAN_R1, PLAN_R3]))
    const plans = [...view.gaps.required, ...view.gaps.niceToHave].map((gap) => gap.plan)

    expect(plans).not.toContainEqual(PLAN_R1)
    expect(view.gaps.required.map((gap) => gap.requirement.id)).not.toContain('r1')
  })

  test('of two plans stored for one requirement the first is used', () => {
    const second: LearningPlan = { ...PLAN_R3, steps: ['A different step'], effort: 'months' }
    const view = buildFitView(JOB, withAdvice([PLAN_R3, second]))

    expect(view.gaps.required[0]?.plan).toEqual(PLAN_R3)
  })

  test('advice null gives gaps with plan null, hasAdvice false and no tailoring', () => {
    const view = buildFitView(JOB, analysis({ advice: null }))

    expect(view.hasAdvice).toBe(false)
    expect(view.tailoring).toBeNull()
    expect(view.gaps.required.length).toBeGreaterThan(0)
    expect([...view.gaps.required, ...view.gaps.niceToHave].every((gap) => gap.plan === null)).toBe(
      true,
    )
  })

  test('advice present sets hasAdvice and carries the tailoring part', () => {
    const tailoring = { emphasise: [], keywords: ['GraphQL'] }
    const view = buildFitView(JOB, analysis({ advice: { plans: [], tailoring } }))

    expect(view.hasAdvice).toBe(true)
    expect(view.tailoring).toEqual(tailoring)
  })

  test('a result with every requirement met has no gaps', () => {
    const everyRequirementMet = JOB.requirements.map((requirement) => ({
      requirementId: requirement.id,
      rating: 'met' as const,
      quote: 'quoted',
      rationale: 'Yes.',
      quoteRejected: false,
    }))
    const view = buildFitView(JOB, analysis({ ratings: everyRequirementMet }))

    expect(view.gaps).toEqual({ required: [], niceToHave: [] })
  })

  test('the score is the same with and without advice', () => {
    const without = buildFitView(JOB, analysis({ advice: null }))
    const withPlans = buildFitView(JOB, withAdvice([PLAN_N1, PLAN_R3]))

    expect(withPlans.score).toBe(without.score)
    expect(withPlans.band).toBe(without.band)
    expect(withPlans.requiredMet).toBe(without.requiredMet)
  })
})
