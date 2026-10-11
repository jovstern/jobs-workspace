import { FIT_SCHEMA_VERSION, fitResponseSchema } from '@jobs-workspace/shared'
import type { FitResponse, Job, RatedRequirement } from '@jobs-workspace/shared'

import type { AiClient, AiUsage, GenerateJsonRequest } from '../ai/client'
import { prepareResumeForModel } from '../ai/prepare'
import {
  buildFitUserTurn,
  FIT_PROMPT_VERSION,
  FIT_SYSTEM_INSTRUCTION,
  fitModelOutputSchema,
} from '../ai/prompts/fit'
import { MODELS } from '../config/models'

const RATIONALE_MAX = 400

export interface AnalyzeFitInput {
  ai: AiClient
  job: Job
  resumeText: string
  signal: AbortSignal
  now: () => number
  overrides?: GenerateJsonRequest<unknown>['overrides']
  onUsage?: (usage: AiUsage) => void
}

// RED-phase stand-in: reconciles ids and order but trusts every quote. Replaced in the next commit.
export async function analyzeFit(input: AnalyzeFitInput): Promise<FitResponse> {
  const { ai, job, resumeText, signal, now, overrides, onUsage } = input
  const output = await ai.generateJson({
    task: 'fit',
    system: FIT_SYSTEM_INSTRUCTION,
    userText: buildFitUserTurn(job, prepareResumeForModel(resumeText)),
    schema: fitModelOutputSchema(job.requirements.map((requirement) => requirement.id)),
    signal,
    overrides,
    onUsage,
  })
  const ratings = job.requirements.map((requirement): RatedRequirement => {
    const rated = output.ratings.find((rating) => rating.requirementId === requirement.id)
    return {
      requirementId: requirement.id,
      rating: rated?.rating ?? 'not_evidenced',
      quote: rated?.quote ?? null,
      rationale: (rated?.rationale ?? '').slice(0, RATIONALE_MAX),
      quoteRejected: false,
    }
  })
  return fitResponseSchema.parse({
    jobId: job.id,
    jobContentVersion: job.contentVersion,
    model: MODELS.fit.id,
    promptVersion: FIT_PROMPT_VERSION,
    schemaVersion: FIT_SCHEMA_VERSION,
    analysedAt: new Date(now()).toISOString(),
    ratings,
    advice: null,
  })
}
