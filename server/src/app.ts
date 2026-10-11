import express from 'express'

import type { HealthResponse } from '@jobs-workspace/shared'

import type { AiClient } from './ai/client'
import { parseEnv } from './config/env'
import type { Env } from './config/env'
import { createFitRouter } from './fit/routes'
import { errorHandler, notFoundHandler } from './http/errors'
import { localOrigin } from './http/local-origin'
import { createRateLimiter } from './http/rate-limit'
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

export function createApp(deps: Partial<AppDeps> = {}) {
  const ai = deps.ai ?? null
  const now = deps.now ?? Date.now
  const env = deps.env ?? parseEnv({})
  // Quiet by default so tests stay silent; the running server passes a real logger.
  const log = deps.log ?? (() => undefined)

  const app = express()
  app.disable('x-powered-by')

  // Fixed order: request log, origin guard, routes, not-found, error handler. The log sees every
  // request, including the ones the guard refuses.
  app.use(requestLog({ log, now }))
  app.use(localOrigin({ allowedOrigins: env.allowedOrigins }))

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok', aiConfigured: ai !== null }
    res.json(body)
  })

  app.use('/api/jobs', createJobsRouter())
  // The limiter sits ahead of the fit router, so an over-limit request is refused before its
  // body is parsed.
  if (deps.rateLimit) {
    app.use('/api/fit', createRateLimiter({ ...deps.rateLimit, now }))
  }
  app.use('/api/fit', createFitRouter({ ai, now }))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
