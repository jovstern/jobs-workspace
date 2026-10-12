import { z } from 'zod'

import { resumeTextSchema } from './resume'

export const FIT_SCHEMA_VERSION = 1

export const ratingSchema = z.enum(['met', 'partial', 'not_evidenced'])
export type Rating = z.infer<typeof ratingSchema>

// Strict on purpose: the client sends a job id and resume text only. Model id, prompt text and
// requirement list are never accepted from a request.
export const fitRequestSchema = z.strictObject({
  jobId: z.string().min(1).max(80),
  resumeText: resumeTextSchema,
})
export type FitRequest = z.infer<typeof fitRequestSchema>

export const ratedRequirementSchema = z.object({
  requirementId: z.string().min(1),
  rating: ratingSchema,
  quote: z.string().nullable(),
  rationale: z.string().max(400),
  quoteRejected: z.boolean(),
})
export type RatedRequirement = z.infer<typeof ratedRequirementSchema>

// Advice is the learning plans and the tailoring tips that come with a fit check. Every limit on
// its text lives here and only here: the schema shown to the AI provider cannot carry string
// bounds, so these bounds are applied in code, item by item, before anything is stored.
export const EFFORTS = ['days', 'weeks', 'months'] as const
export type Effort = (typeof EFFORTS)[number]

export const PLAN_STEPS_MAX = 4
export const PLAN_STEP_MAX_CHARS = 200
export const PLAN_WHY_MAX_CHARS = 400
export const PLANS_MAX = 10
export const TIPS_MAX = 5
export const TIP_QUOTE_MAX_CHARS = 600
export const TIP_ADVICE_MAX_CHARS = 400
export const KEYWORDS_MAX = 8
export const KEYWORD_MIN_CHARS = 2
export const KEYWORD_MAX_CHARS = 40

// The model is asked for 2 to 4 steps; one surviving step is still a plan.
export const learningPlanSchema = z.object({
  requirementId: z.string().min(1),
  steps: z.array(z.string().min(1).max(PLAN_STEP_MAX_CHARS)).min(1).max(PLAN_STEPS_MAX),
  whyItMatters: z.string().min(1).max(PLAN_WHY_MAX_CHARS),
  effort: z.enum(EFFORTS),
})
export type LearningPlan = z.infer<typeof learningPlanSchema>

export const emphasiseTipSchema = z.object({
  quote: z.string().min(1).max(TIP_QUOTE_MAX_CHARS),
  advice: z.string().min(1).max(TIP_ADVICE_MAX_CHARS),
})
export type EmphasiseTip = z.infer<typeof emphasiseTipSchema>

export const tailoringSchema = z.object({
  emphasise: z.array(emphasiseTipSchema).max(TIPS_MAX),
  keywords: z.array(z.string().min(KEYWORD_MIN_CHARS).max(KEYWORD_MAX_CHARS)).max(KEYWORDS_MAX),
})
export type Tailoring = z.infer<typeof tailoringSchema>

// `tailoring` null means the tips part of the answer was unusable; the plans can still be good.
export const adviceSchema = z.object({
  plans: z.array(learningPlanSchema).max(PLANS_MAX),
  tailoring: tailoringSchema.nullable(),
})
export type Advice = z.infer<typeof adviceSchema>

// `advice` is null on a result made before advice existed (Phase 1). Widening it from null to
// "advice or null" needs no storage migration, because null stays valid.
// Deliberately no numeric rating field here: it is computed in code from the per-requirement ratings.
export const fitResponseSchema = z.object({
  jobId: z.string().min(1),
  jobContentVersion: z.string().min(1),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  schemaVersion: z.literal(FIT_SCHEMA_VERSION),
  analysedAt: z.iso.datetime(),
  ratings: z.array(ratedRequirementSchema),
  advice: adviceSchema.nullable(),
})
export type FitResponse = z.infer<typeof fitResponseSchema>

export const storedAnalysisSchema = fitResponseSchema.extend({
  resumeHash: z.string().regex(/^[0-9a-f]{64}$/),
})
export type StoredAnalysis = z.infer<typeof storedAnalysisSchema>
