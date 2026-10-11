import express from 'express'
import { Router } from 'express'

import { FIT_SCHEMA_VERSION, fitRequestSchema, fitResponseSchema } from '@jobs-workspace/shared'
import type { FitResponse, RatedRequirement } from '@jobs-workspace/shared'

import type { AiClient } from '../ai/client'
import { prepareResumeForModel } from '../ai/prepare'
import {
  buildFitUserTurn,
  FIT_PROMPT_VERSION,
  FIT_SYSTEM_INSTRUCTION,
  fitModelOutputSchema,
} from '../ai/prompts/fit'
import { MODELS } from '../config/models'
import { AppError, parseBody } from '../http/errors'
import { getJob } from '../jobs/seed'

const RATIONALE_MAX = 400

export interface FitRouterDeps {
  ai: AiClient | null
  now: () => number
}

export function createFitRouter({ ai, now }: FitRouterDeps): Router {
  const router = Router()

  router.post('/', express.json({ limit: '256kb' }), async (req, res) => {
    const body = parseBody(fitRequestSchema, req.body)
    const job = getJob(body.jobId)
    if (!job) throw new AppError('not_found')
    if (!ai) throw new AppError('ai_not_configured')

    // Stop waiting for the model when the browser goes away before we have answered.
    const controller = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })

    // Contact details are removed here for every request, whatever the browser sent. Nothing
    // derived from the raw resume text may reach the prompt, and nothing here is logged.
    const resumeForModel = prepareResumeForModel(body.resumeText)

    const output = await ai.generateJson({
      task: 'fit',
      system: FIT_SYSTEM_INSTRUCTION,
      userText: buildFitUserTurn(job, resumeForModel),
      schema: fitModelOutputSchema(job.requirements.map((requirement) => requirement.id)),
      signal: controller.signal,
    })

    // Posting order, one entry per requirement; anything the model left out is not evidenced.
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

    const response: FitResponse = {
      jobId: job.id,
      jobContentVersion: job.contentVersion,
      model: MODELS.fit.id,
      promptVersion: FIT_PROMPT_VERSION,
      schemaVersion: FIT_SCHEMA_VERSION,
      analysedAt: new Date(now()).toISOString(),
      ratings,
      advice: null,
    }
    res.json(fitResponseSchema.parse(response))
  })

  return router
}
