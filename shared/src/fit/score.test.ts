import { describe, expect, test } from 'vitest'

import type { Rating } from '../fit'
import type { Requirement } from '../job'
import { BANDS, CREDIT, bandFor, computeFit } from './score'

function requirement(id: string, kind: Requirement['kind']): Requirement {
  return { id, text: `Requirement ${id}`, kind, skill: 'React' }
}

function jobRequirements(required: number, nice: number): Requirement[] {
  return [
    ...Array.from({ length: required }, (_, index) =>
      requirement(`r${String(index + 1)}`, 'required'),
    ),
    ...Array.from({ length: nice }, (_, index) =>
      requirement(`n${String(index + 1)}`, 'nice_to_have'),
    ),
  ]
}

// Ratings for the first requirements of each group, in order; anything not listed is left unrated.
function ratingsFor(requirements: Requirement[], required: Rating[], nice: Rating[]) {
  const requiredIds = requirements.filter((item) => item.kind === 'required')
  const niceIds = requirements.filter((item) => item.kind === 'nice_to_have')
  return [
    ...required.map((rating, index) => ({
      requirementId: requiredIds[index]?.id ?? 'missing',
      rating,
    })),
    ...nice.map((rating, index) => ({ requirementId: niceIds[index]?.id ?? 'missing', rating })),
  ]
}

const M: Rating = 'met'
const P: Rating = 'partial'
const N: Rating = 'not_evidenced'

function score(required: Rating[], nice: Rating[]) {
  const requirements = jobRequirements(6, 3)
  return computeFit({ requirements, ratings: ratingsFor(requirements, required, nice) })
}

describe('computeFit scenarios (6 required, 3 nice to have)', () => {
  test('all required met and no nice to have met gives 90, Strong fit', () => {
    expect(score([M, M, M, M, M, M], [N, N, N])).toMatchObject({ score: 90, band: 'Strong fit' })
  })

  test('everything met gives 100, Strong fit', () => {
    expect(score([M, M, M, M, M, M], [M, M, M])).toMatchObject({ score: 100, band: 'Strong fit' })
  })

  test('5 met and 1 partial gives 83, Strong fit', () => {
    expect(score([M, M, M, M, M, P], [N, N, N])).toMatchObject({ score: 83, band: 'Strong fit' })
  })

  test('4 met and 2 partial gives 75, Good fit', () => {
    expect(score([M, M, M, M, P, P], [N, N, N])).toMatchObject({ score: 75, band: 'Good fit' })
  })

  test('4 met and 2 not evidenced gives 60, Good fit', () => {
    expect(score([M, M, M, M, N, N], [N, N, N])).toMatchObject({ score: 60, band: 'Good fit' })
  })

  test('4 met and 2 not evidenced with all nice to have met gives 67, Good fit', () => {
    expect(score([M, M, M, M, N, N], [M, M, M])).toMatchObject({ score: 67, band: 'Good fit' })
  })

  test('3 met and 3 not evidenced gives 45, Stretch', () => {
    expect(score([M, M, M, N, N, N], [N, N, N])).toMatchObject({ score: 45, band: 'Stretch' })
  })

  test('2 met, 4 not evidenced and all nice to have met gives 33, Long shot', () => {
    expect(score([M, M, N, N, N, N], [M, M, M])).toMatchObject({ score: 33, band: 'Long shot' })
  })

  test('no required credit with all nice to have met gives 0, Long shot', () => {
    expect(score([N, N, N, N, N, N], [M, M, M])).toMatchObject({ score: 0, band: 'Long shot' })
  })
})

describe('bandFor', () => {
  test.each([
    [80, 'Strong fit'],
    [60, 'Good fit'],
    [40, 'Stretch'],
  ] as const)('%i is %s', (value, band) => {
    expect(bandFor(value)).toBe(band)
  })

  test.each([
    [79, 'Good fit'],
    [59, 'Stretch'],
    [39, 'Long shot'],
  ] as const)('%i is %s', (value, band) => {
    expect(bandFor(value)).toBe(band)
  })

  test('the band names and credits are fixed', () => {
    expect(BANDS).toEqual(['Strong fit', 'Good fit', 'Stretch', 'Long shot'])
    expect(CREDIT).toEqual({ met: 1, partial: 0.5, not_evidenced: 0 })
  })
})

describe('computeFit properties', () => {
  const requirements = jobRequirements(3, 2)
  const STEPS: Rating[] = [N, P, M]

  // Every combination of ratings for 3 required and 2 nice to have requirements: 3^5 = 243.
  const combinations: Rating[][] = STEPS.flatMap((a) =>
    STEPS.flatMap((b) =>
      STEPS.flatMap((c) => STEPS.flatMap((d) => STEPS.map((e) => [a, b, c, d, e]))),
    ),
  )

  function scoreOf(all: Rating[]) {
    return computeFit({
      requirements,
      ratings: ratingsFor(requirements, all.slice(0, 3), all.slice(3)),
    })
  }

  test('the score is always a whole number from 0 to 100', () => {
    for (const combination of combinations) {
      const { score: value } = scoreOf(combination)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  test('raising any single rating never lowers the score', () => {
    for (const combination of combinations) {
      const before = scoreOf(combination).score ?? -1
      combination.forEach((rating, index) => {
        const next = STEPS[STEPS.indexOf(rating) + 1]
        if (next === undefined) return
        const raised = combination.map((item, position) => (position === index ? next : item))
        expect(scoreOf(raised).score ?? -1).toBeGreaterThanOrEqual(before)
      })
    }
  })

  test('nice to have items add at most 10 points, scaled by the required average', () => {
    for (const combination of combinations) {
      const requiredOnly = scoreOf([...combination.slice(0, 3), N, N]).score ?? 0
      const withNice = scoreOf([...combination.slice(0, 3), M, M]).score ?? 0
      const requiredAverage =
        combination.slice(0, 3).reduce((sum, rating) => sum + CREDIT[rating], 0) / 3
      expect(withNice - requiredOnly).toBeLessThanOrEqual(0.1 * 100 * requiredAverage + 1)
      expect(withNice).toBeLessThanOrEqual(Math.round(100 * requiredAverage))
    }
  })

  test('nice to have items cannot lift a job with no required credit above 0', () => {
    expect(scoreOf([N, N, N, M, M]).score).toBe(0)
  })
})

describe('computeFit edge cases', () => {
  test('a job with no nice to have items uses a nice average of 0', () => {
    const only = jobRequirements(6, 0)
    const result = computeFit({
      requirements: only,
      ratings: ratingsFor(only, [M, M, M, M, M, M], []),
    })
    expect(result.score).toBe(90)
  })

  test('a job with no required items has no score and no band', () => {
    const niceOnly = jobRequirements(0, 3)
    const result = computeFit({
      requirements: niceOnly,
      ratings: ratingsFor(niceOnly, [], [M, M, M]),
    })
    expect(result).toEqual({ score: null, band: null, requiredMet: 0, requiredTotal: 0 })
  })

  test('a requirement with no rating counts as not evidenced', () => {
    const requirements = jobRequirements(2, 0)
    const result = computeFit({ requirements, ratings: ratingsFor(requirements, [M], []) })
    expect(result.score).toBe(45)
  })

  test('a rating for an unknown requirement id is ignored', () => {
    const requirements = jobRequirements(2, 0)
    const ratings = [
      ...ratingsFor(requirements, [M, M], []),
      { requirementId: 'not-in-this-job', rating: M },
    ]
    expect(computeFit({ requirements, ratings }).score).toBe(90)
  })

  test('requiredMet counts required requirements rated met, requiredTotal counts required', () => {
    const result = score([M, M, P, N, M, N], [M, M, M])
    expect(result.requiredMet).toBe(3)
    expect(result.requiredTotal).toBe(6)
  })
})
