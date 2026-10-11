import { FIT_SCHEMA_VERSION, fitResponseSchema } from '@jobs-workspace/shared'
import type { FitResponse, Job, RatedRequirement } from '@jobs-workspace/shared'
import type { z } from 'zod'

import type { AiClient, AiUsage, GenerateJsonRequest } from '../ai/client'
import { prepareResumeForModel } from '../ai/prepare'
import {
  buildFitUserTurn,
  FIT_PROMPT_VERSION,
  FIT_SYSTEM_INSTRUCTION,
  fitModelOutputSchema,
} from '../ai/prompts/fit'
import { MODELS } from '../config/models'
import { buildResumeIndex, verifyQuote } from './quotes'
import type { ResumeIndex } from './quotes'

const RATIONALE_MAX = 400

export interface AnalyzeFitInput {
  ai: AiClient
  job: Job
  resumeText: string
  signal: AbortSignal
  now: () => number
  overrides?: GenerateJsonRequest<unknown>['overrides']
  onUsage?: (usage: AiUsage) => void
  onFailure?: GenerateJsonRequest<unknown>['onFailure']
}

type ModelRating = z.infer<ReturnType<typeof fitModelOutputSchema>>['ratings'][number]

function notEvidenced(requirementId: string, rationale: string, quoteRejected: boolean) {
  return {
    requirementId,
    rating: 'not_evidenced',
    quote: null,
    rationale,
    quoteRejected,
  } satisfies RatedRequirement
}

// One requirement's final rating. Nothing is met or partial unless its quote occurs in the text
// that was sent to the model; otherwise the rating is withdrawn and the user is told why. The
// rationale of a withdrawn rating is dropped too, since it argued for evidence that is not there.
function settle(requirementId: string, rated: ModelRating | undefined, index: ResumeIndex) {
  if (rated === undefined) return notEvidenced(requirementId, '', false)
  const rationale = rated.rationale.slice(0, RATIONALE_MAX)
  if (rated.rating === 'not_evidenced') return notEvidenced(requirementId, rationale, false)
  if (rated.quote === null || !verifyQuote(rated.quote, index)) {
    return notEvidenced(requirementId, '', true)
  }
  return {
    requirementId,
    rating: rated.rating,
    quote: rated.quote,
    rationale,
    quoteRejected: false,
  } satisfies RatedRequirement
}

// The fit pipeline: prepare the resume once, ask the model for ratings with quotes, reconcile the
// answer with the job's fixed requirement list, verify every quote against the text that was
// sent, and build the response in posting order. The model is called exactly once; a rejected
// quote is never retried, because every call is paid. Nothing here is logged: the resume, the
// quotes and the model output stay inside this function.
export async function analyzeFit(input: AnalyzeFitInput): Promise<FitResponse> {
  const { ai, job, resumeText, signal, now, overrides, onUsage, onFailure } = input

  // The same string is sent and verified against, so the prompt and the check see the same text.
  const prepared = prepareResumeForModel(resumeText)
  const ids = job.requirements.map((requirement) => requirement.id)

  const output = await ai.generateJson({
    task: 'fit',
    system: FIT_SYSTEM_INSTRUCTION,
    userText: buildFitUserTurn(job, prepared),
    schema: fitModelOutputSchema(ids),
    signal,
    overrides,
    onUsage,
    onFailure,
  })

  // First answer for an id wins; ids the job does not have are never looked up.
  const answers = new Map<string, ModelRating>()
  for (const rated of output.ratings) {
    if (!answers.has(rated.requirementId)) answers.set(rated.requirementId, rated)
  }

  const index = buildResumeIndex(prepared)
  const ratings = ids.map((id) => settle(id, answers.get(id), index))

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
