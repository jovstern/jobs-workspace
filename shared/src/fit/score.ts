import type { Rating } from '../fit'
import type { Requirement } from '../job'

export const BANDS = ['Strong fit', 'Good fit', 'Stretch', 'Long shot'] as const
export type Band = (typeof BANDS)[number]

// Met is full credit, partial is half, not evidenced is none (D-10).
export const CREDIT: Record<Rating, number> = { met: 1, partial: 0.5, not_evidenced: 0 }

export interface FitScore {
  score: number | null
  band: Band | null
  requiredMet: number
  requiredTotal: number
}

interface ComputeFitInput {
  requirements: readonly Requirement[]
  ratings: readonly { requirementId: string; rating: Rating }[]
}

// Indexes ratings by requirement id. When an id appears more than once the first row wins, the
// same rule the server uses when it reconciles the model's answer with the job. Stored data is
// untrusted and may hold duplicates, so everything that reads a rating for a requirement, the
// score and the rows on screen alike, goes through this one function and cannot disagree.
export function indexRatingsFirstWins<T extends { requirementId: string }>(
  ratings: readonly T[],
): Map<string, T> {
  const byId = new Map<string, T>()
  for (const item of ratings) {
    if (!byId.has(item.requirementId)) byId.set(item.requirementId, item)
  }
  return byId
}

// Thresholds are inclusive lower bounds: 80, 60 and 40 land in the higher band (D-11).
export function bandFor(score: number): Band {
  if (score >= 80) return 'Strong fit'
  if (score >= 60) return 'Good fit'
  if (score >= 40) return 'Stretch'
  return 'Long shot'
}

function average(credits: readonly number[]): number {
  if (credits.length === 0) return 0
  return credits.reduce((sum, credit) => sum + credit, 0) / credits.length
}

// The score is a pure function of the job's requirements and the rated results; it is never
// stored and never taken from the model (D-10). Required requirements carry the score; the
// nice-to-have average adds at most 10 percent on top and cannot lift a job with no required
// credit above 0. The order of operations matters: it decides rounding at the boundaries.
export function computeFit({ requirements, ratings }: ComputeFitInput): FitScore {
  const ratingById = indexRatingsFirstWins(ratings)

  const ratingOf = (requirement: Requirement): Rating =>
    ratingById.get(requirement.id)?.rating ?? 'not_evidenced'

  const required = requirements.filter((requirement) => requirement.kind === 'required')
  const niceToHave = requirements.filter((requirement) => requirement.kind === 'nice_to_have')
  const requiredMet = required.filter((requirement) => ratingOf(requirement) === 'met').length

  if (required.length === 0) {
    return { score: null, band: null, requiredMet, requiredTotal: 0 }
  }

  const requiredAverage = average(required.map((requirement) => CREDIT[ratingOf(requirement)]))
  const niceAverage = average(niceToHave.map((requirement) => CREDIT[ratingOf(requirement)]))
  const raw = Math.round(100 * requiredAverage * (0.9 + 0.1 * niceAverage))
  const score = Math.min(100, Math.max(0, raw))

  return { score, band: bandFor(score), requiredMet, requiredTotal: required.length }
}
