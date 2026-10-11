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

// `advice` is null in Phase 1; Phase 01.1 widens it, which needs no storage migration.
// Deliberately no numeric rating field here: it is computed in code from the per-requirement ratings.
export const fitResponseSchema = z.object({
  jobId: z.string().min(1),
  jobContentVersion: z.string().min(1),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  schemaVersion: z.literal(FIT_SCHEMA_VERSION),
  analysedAt: z.iso.datetime(),
  ratings: z.array(ratedRequirementSchema),
  advice: z.null(),
})
export type FitResponse = z.infer<typeof fitResponseSchema>

export const storedAnalysisSchema = fitResponseSchema.extend({
  resumeHash: z.string().regex(/^[0-9a-f]{64}$/),
})
export type StoredAnalysis = z.infer<typeof storedAnalysisSchema>
