import express from 'express'

import type { HealthResponse } from '@jobs-workspace/shared'

import type { AiClient } from './ai/client'
import type { Env } from './config/env'
import { createFitRouter } from './fit/routes'
import { errorHandler, notFoundHandler } from './http/errors'
import { requestLog } from './http/request-log'
import { createJobsRouter } from './jobs/routes'

export interface AppDeps {
  ai: AiClient | null
  env: Env
  now: () => number
  log: (line: string) => void
  // Mounted on the paid fit route only when given; the running server always passes it.
  rateLimit: { windowMs: number; max: number }
}

// `env` is accepted now and consumed by a later task (origin checks).
export function createApp(deps: Partial<AppDeps> = {}) {
  const ai = deps.ai ?? null
  const now = deps.now ?? Date.now
  // Quiet by default so tests stay silent; the running server passes a real logger.
  const log = deps.log ?? (() => undefined)

  const app = express()
  app.disable('x-powered-by')
  app.use(requestLog({ log, now }))

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok', aiConfigured: ai !== null }
    res.json(body)
  })

  app.use('/api/jobs', createJobsRouter())
  app.use('/api/fit', createFitRouter({ ai, now }))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
