import express from 'express'
import { Router } from 'express'

import { fitRequestSchema } from '@jobs-workspace/shared'

import type { AiClient } from '../ai/client'
import { AppError, parseBody } from '../http/errors'
import { getJob } from '../jobs/seed'
import { analyzeFit } from './analyze'

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

    // The pipeline owns the resume text from here: contact removal, the model call and quote
    // checking all happen inside it, and nothing about them is kept or logged.
    res.json(
      await analyzeFit({
        ai,
        job,
        resumeText: body.resumeText,
        signal: controller.signal,
        now,
      }),
    )
  })

  return router
}
