import express from 'express'
import { Router } from 'express'

import { fitRequestSchema } from '@jobs-workspace/shared'

import type { AiClient } from '../ai/client'
import type { AiFailureDiagnostic } from '../ai/diagnose'
import { AppError, parseBody } from '../http/errors'
import { getJob } from '../jobs/seed'
import { analyzeFit } from './analyze'

export interface FitRouterDeps {
  ai: AiClient | null
  now: () => number
  log: (line: string) => void
}

// The one line written when a model call fails. Both values come from fixed lists (an HTTP status
// number and a failure category); no message, body, key, prompt or resume text can reach it.
export function formatFailureLine(diagnostic: AiFailureDiagnostic): string {
  const status = diagnostic.httpStatus === null ? 'none' : String(diagnostic.httpStatus)
  return `fit failed status=${status} category=${diagnostic.category}`
}

export function createFitRouter({ ai, now, log }: FitRouterDeps): Router {
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
        onFailure: (diagnostic) => {
          log(formatFailureLine(diagnostic))
        },
      }),
    )
  })

  return router
}
