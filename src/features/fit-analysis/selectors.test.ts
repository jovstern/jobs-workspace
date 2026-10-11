import type { Job, StoredAnalysis } from '@jobs-workspace/shared'
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
})
