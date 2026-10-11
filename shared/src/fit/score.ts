import type { Rating } from '../fit'
import type { Requirement } from '../job'

// Red-phase stand-in: the real formula arrives in the next commit.
export type Band = 'Strong fit' | 'Good fit' | 'Stretch' | 'Long shot'
export const BANDS: readonly Band[] = []
export const CREDIT: Record<Rating, number> = { met: 0, partial: 0, not_evidenced: 0 }

export interface FitScore {
  score: number | null
  band: Band | null
  requiredMet: number
  requiredTotal: number
}

export function bandFor(score: number): Band {
  return score > Infinity ? 'Strong fit' : 'Long shot'
}

export function computeFit(input: {
  requirements: readonly Requirement[]
  ratings: readonly { requirementId: string; rating: Rating }[]
}): FitScore {
  return { score: null, band: null, requiredMet: input.ratings.length * 0, requiredTotal: 0 }
}
