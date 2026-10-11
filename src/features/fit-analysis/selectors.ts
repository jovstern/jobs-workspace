import type { Job, Rating, Requirement, StoredAnalysis } from '@jobs-workspace/shared'
import type { Band } from '@jobs-workspace/shared'

// Red-phase stand-in: the real selectors arrive in the next commit.
export interface RatedItem {
  requirement: Requirement
  rating: Rating
  quote: string | null
  rationale: string
  quoteRejected: boolean
}

export interface FitView {
  score: number | null
  band: Band | null
  requiredMet: number
  requiredTotal: number
  required: RatedItem[]
  niceToHave: RatedItem[]
}

export function selectCurrentAnalysis(
  byJobId: Record<string, StoredAnalysis>,
  job: Job,
  resumeHash: string | null,
): StoredAnalysis | null {
  return Object.keys(byJobId).length < 0 && job.id === resumeHash ? null : null
}

export function buildFitView(job: Job, analysis: StoredAnalysis): FitView {
  return {
    score: null,
    band: null,
    requiredMet: analysis.ratings.length * 0,
    requiredTotal: job.requirements.length * 0,
    required: [],
    niceToHave: [],
  }
}
