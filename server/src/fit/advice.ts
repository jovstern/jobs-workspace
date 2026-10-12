import {
  adviceSchema,
  EFFORTS,
  indexRatingsFirstWins,
  KEYWORD_MAX_CHARS,
  KEYWORD_MIN_CHARS,
  KEYWORDS_MAX,
  PLAN_STEP_MAX_CHARS,
  PLAN_STEPS_MAX,
  PLAN_WHY_MAX_CHARS,
  TIP_ADVICE_MAX_CHARS,
  TIP_QUOTE_MAX_CHARS,
  TIPS_MAX,
} from '@jobs-workspace/shared'
import type {
  Advice,
  Effort,
  EmphasiseTip,
  Job,
  LearningPlan,
  RatedRequirement,
  Tailoring,
} from '@jobs-workspace/shared'

import { containsLink, keywordIsMissing, namesLearningPlatform, postingTextOf } from './advice-text'
import { normaliseForMatch, verifyQuote } from './quotes'
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

// A text the model gave for a plan: a string of 1 to `max` characters once trimmed, with no link and
// no learning-platform name. The length is checked first, so the pattern tests only see short
// strings. Returns the trimmed text, or null: a text that fails is never repaired or shortened.
function usableText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (text === '' || text.length > max) return null
  if (containsLink(text) || namesLearningPlatform(text)) return null
  return text
}

// The steps of one plan that are worth keeping, first PLAN_STEPS_MAX of them. A step that fails is
// dropped on its own and counted; the plan is kept while at least one step survives.
function usableSteps(rawSteps: readonly unknown[], stats: AdviceStats): string[] {
  const steps: string[] = []
  for (const raw of rawSteps) {
    const step = usableText(raw, PLAN_STEP_MAX_CHARS)
    if (step === null) stats.stepsDropped += 1
    else steps.push(step)
  }
  return steps.slice(0, PLAN_STEPS_MAX)
}

function isEffort(value: unknown): value is Effort {
  return EFFORTS.some((effort) => effort === value)
}

// One plan as the model wrote it, or null when it cannot be kept. Every rule drops the plan whole
// except a bad step, which only costs that step.
function usablePlan(raw: unknown, stats: AdviceStats): LearningPlan | null {
  if (!isRecord(raw) || typeof raw.requirementId !== 'string') return null
  if (!Array.isArray(raw.steps)) return null
  const steps = usableSteps(raw.steps as unknown[], stats)
  const whyItMatters = usableText(raw.whyItMatters, PLAN_WHY_MAX_CHARS)
  const effort = typeof raw.effort === 'string' ? raw.effort.trim() : raw.effort
  if (steps.length === 0 || whyItMatters === null || !isEffort(effort)) return null
  return { requirementId: raw.requirementId.trim(), steps, whyItMatters, effort }
}

// The plans worth keeping: one per gap of this job, in the job's posting sequence. A plan is for a
// requirement of this job that is not rated met, and the first plan that survives its checks for a
// requirement wins (as ratings do).
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
    const requirementId =
      isRecord(raw) && typeof raw.requirementId === 'string' ? raw.requirementId.trim() : ''
    if (!gapIds.has(requirementId) || kept.has(requirementId)) continue
    const plan = usablePlan(raw, stats)
    if (plan !== null) kept.set(plan.requirementId, plan)
  }

  stats.plansKept = kept.size
  return job.requirements.flatMap((requirement) => {
    const plan = kept.get(requirement.id)
    return plan === undefined ? [] : [plan]
  })
}

// How many words a keyword may have: a skill or a tool name, not a sentence.
const KEYWORD_MAX_WORDS = 4

// The tips worth keeping. A tip is kept only when its quote really is in the resume that was sent
// (checked with the same verifyQuote as rating quotes) and its advice is short, plain text with no
// link and no learning-platform name. Nothing is repaired: a tip that fails is dropped whole, so a
// tip is never returned without its verified quote. The first TIPS_MAX survivors are kept.
function keepTips(rawTips: unknown, index: ResumeIndex, stats: AdviceStats): EmphasiseTip[] {
  if (!Array.isArray(rawTips)) return []
  stats.tipsReceived = rawTips.length

  const tips: EmphasiseTip[] = []
  const seen = new Set<string>()
  for (const raw of rawTips as unknown[]) {
    if (tips.length >= TIPS_MAX) break
    if (!isRecord(raw) || typeof raw.quote !== 'string') continue
    const quote = raw.quote.trim()
    if (quote === '' || quote.length > TIP_QUOTE_MAX_CHARS || !verifyQuote(quote, index)) continue
    const advice = usableText(raw.advice, TIP_ADVICE_MAX_CHARS)
    const key = normaliseForMatch(quote)
    if (advice === null || seen.has(key)) continue
    seen.add(key)
    tips.push({ quote, advice })
  }
  stats.tipsKept = tips.length
  return tips
}

// The keywords worth keeping: words from the posting that the resume does not use, as the model
// wrote them apart from trimming. The first KEYWORDS_MAX survivors are kept.
function keepKeywords(rawKeywords: unknown, input: BuildAdviceInput, stats: AdviceStats): string[] {
  if (!Array.isArray(rawKeywords)) return []
  stats.keywordsReceived = rawKeywords.length

  const posting = postingTextOf(input.job)
  const keywords: string[] = []
  const seen = new Set<string>()
  for (const raw of rawKeywords as unknown[]) {
    if (keywords.length >= KEYWORDS_MAX) break
    if (typeof raw !== 'string') continue
    const keyword = raw.trim()
    if (keyword.length < KEYWORD_MIN_CHARS || keyword.length > KEYWORD_MAX_CHARS) continue
    if (keyword.split(/\s+/).length > KEYWORD_MAX_WORDS || containsLink(keyword)) continue
    const key = normaliseForMatch(keyword)
    if (seen.has(key) || !keywordIsMissing(keyword, posting, input.index)) continue
    seen.add(key)
    keywords.push(keyword)
  }
  stats.keywordsKept = keywords.length
  return keywords
}

// The tailoring part of the answer, or null when the model did not give an object. An object whose
// items are all dropped is still usable: it gives empty lists.
function keepTailoring(input: BuildAdviceInput, stats: AdviceStats): Tailoring | null {
  const { rawTailoring } = input
  if (!isRecord(rawTailoring)) return null
  stats.tailoringUsable = true
  return {
    emphasise: keepTips(rawTailoring.emphasise, input.index, stats),
    keywords: keepKeywords(rawTailoring.keywords, input, stats),
  }
}

// Turns what the model said about advice into advice the shared schema accepts. It cannot throw
// and cannot fail the response: anything unusable becomes "no plans" and "no tailoring", so a
// defect in advice never costs the user the ratings. Every plan step, tip and keyword is checked
// in code before it is returned, and nothing is repaired. Nothing is logged here.
export function buildAdvice(input: BuildAdviceInput): { advice: Advice; stats: AdviceStats } {
  const stats = emptyStats()
  try {
    const plans = keepPlans(input, stats)
    const tailoring = keepTailoring(input, stats)
    const checked = adviceSchema.safeParse({ plans, tailoring })
    if (checked.success) return { advice: checked.data, stats }
  } catch {
    // Falls through to the empty advice below.
  }
  return {
    advice: EMPTY_ADVICE,
    stats: {
      ...emptyStats(),
      plansReceived: stats.plansReceived,
      tipsReceived: stats.tipsReceived,
    },
  }
}
