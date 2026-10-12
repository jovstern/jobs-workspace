import { adviceSchema, indexRatingsFirstWins, learningPlanSchema } from '@jobs-workspace/shared'
import type { Advice, Job, LearningPlan, RatedRequirement } from '@jobs-workspace/shared'

import type { ResumeIndex } from './quotes'

export interface BuildAdviceInput {
  // What the model said about plans and tailoring, as it came: nothing about it is trusted.
  rawPlans: unknown
  rawTailoring: unknown
  job: Job
  // The final ratings, after quotes were checked. A rating withdrawn for an unverifiable quote is
  // a gap here, so a plan written for it is valid, and a plan for a met requirement is not.
  ratings: readonly RatedRequirement[]
  index: ResumeIndex
}

// Numbers only, for the spike script. They are never logged by the route.
export interface AdviceStats {
  plansReceived: number
  plansKept: number
  stepsDropped: number
  tipsReceived: number
  tipsKept: number
  keywordsReceived: number
  keywordsKept: number
  tailoringUsable: boolean
}

const EMPTY_ADVICE: Advice = { plans: [], tailoring: null }

function emptyStats(): AdviceStats {
  return {
    plansReceived: 0,
    plansKept: 0,
    stepsDropped: 0,
    tipsReceived: 0,
    tipsKept: 0,
    keywordsReceived: 0,
    keywordsKept: 0,
    tailoringUsable: false,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function trimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value
}

// A plan as the model wrote it, with every string trimmed, ready for the strict schema.
function normalisePlan(raw: unknown): unknown {
  if (!isRecord(raw)) return null
  return {
    requirementId: trimmed(raw.requirementId),
    steps: Array.isArray(raw.steps) ? raw.steps.map(trimmed) : raw.steps,
    whyItMatters: trimmed(raw.whyItMatters),
    effort: trimmed(raw.effort),
  }
}

// The plans worth keeping: one per gap of this job, in the job's posting sequence. A plan is kept
// only when it passes the strict shared schema, its requirement is in this job and not rated met,
// and no earlier kept plan was for the same requirement (the first wins, as ratings do).
function keepPlans(input: BuildAdviceInput, stats: AdviceStats): LearningPlan[] {
  const { rawPlans, job, ratings } = input
  if (!Array.isArray(rawPlans)) return []
  stats.plansReceived = rawPlans.length

  const ratingById = indexRatingsFirstWins(ratings)
  const gapIds = new Set(
    job.requirements
      .filter((requirement) => ratingById.get(requirement.id)?.rating !== 'met')
      .map((requirement) => requirement.id),
  )

  const kept = new Map<string, LearningPlan>()
  for (const raw of rawPlans as unknown[]) {
    const parsed = learningPlanSchema.safeParse(normalisePlan(raw))
    if (!parsed.success) continue
    const plan = parsed.data
    if (!gapIds.has(plan.requirementId) || kept.has(plan.requirementId)) continue
    kept.set(plan.requirementId, plan)
  }

  stats.plansKept = kept.size
  return job.requirements.flatMap((requirement) => {
    const plan = kept.get(requirement.id)
    return plan === undefined ? [] : [plan]
  })
}

// Turns what the model said about advice into advice the shared schema accepts. It cannot throw
// and cannot fail the response: anything unusable becomes "no plans" and "no tailoring", so a
// defect in advice never costs the user the ratings. Tailoring is always null for now; a tip that
// has not been checked against the resume must never reach the user. Nothing is logged here.
export function buildAdvice(input: BuildAdviceInput): { advice: Advice; stats: AdviceStats } {
  const stats = emptyStats()
  try {
    const plans = keepPlans(input, stats)
    const checked = adviceSchema.safeParse({ plans, tailoring: null })
    if (checked.success) return { advice: checked.data, stats }
  } catch {
    // Falls through to the empty advice below.
  }
  return { advice: EMPTY_ADVICE, stats: { ...stats, plansKept: 0 } }
}
