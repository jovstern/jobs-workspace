import { computeFit, indexRatingsFirstWins } from '@jobs-workspace/shared'
import type { Band, Job, Rating, Requirement, StoredAnalysis } from '@jobs-workspace/shared'

// A requirement joined with its stored rating, ready to show.
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

// A stored result counts as current only for the resume text and the job version it was made
// from. Anything else is not shown as a result; marking it "resume changed, re-check?" is
// Phase 01.2 (FIT-10). Reading never triggers a request.
export function selectCurrentAnalysis(
  byJobId: Readonly<Record<string, StoredAnalysis>>,
  job: Job,
  resumeHash: string | null,
): StoredAnalysis | null {
  if (resumeHash === null) return null
  const stored = byJobId[job.id]
  if (stored?.resumeHash !== resumeHash) return null
  if (stored.jobContentVersion !== job.contentVersion) return null
  return stored
}

// Derived on every call: the score is computed from the stored ratings and never stored.
export function buildFitView(job: Job, analysis: StoredAnalysis): FitView {
  const ratingById = indexRatingsFirstWins(analysis.ratings)

  const items: RatedItem[] = job.requirements.map((requirement) => {
    const stored = ratingById.get(requirement.id)
    return {
      requirement,
      rating: stored?.rating ?? 'not_evidenced',
      quote: stored?.quote ?? null,
      rationale: stored?.rationale ?? '',
      quoteRejected: stored?.quoteRejected ?? false,
    }
  })

  return {
    ...computeFit({ requirements: job.requirements, ratings: analysis.ratings }),
    required: items.filter((item) => item.requirement.kind === 'required'),
    niceToHave: items.filter((item) => item.requirement.kind === 'nice_to_have'),
  }
}
