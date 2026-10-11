import express from 'express'
import { z } from 'zod'

import type { AiClient } from './ai/client'
import type { Env } from './config/env'
import { createFitRouter } from './fit/routes'
import { errorHandler, notFoundHandler } from './http/errors'

export const healthResponseSchema = z.object({ status: z.literal('ok') })
export type HealthResponse = z.infer<typeof healthResponseSchema>

export interface AppDeps {
  ai: AiClient | null
  env: Env
  now: () => number
  log: (line: string) => void
}

// `env` and `log` are accepted now and consumed by later plans (origin checks, request log).
export function createApp(deps: Partial<AppDeps> = {}) {
  const ai = deps.ai ?? null
  const now = deps.now ?? Date.now

  const app = express()
  app.disable('x-powered-by')

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok' }
    res.json(body)
  })

  app.use('/api/fit', createFitRouter({ ai, now }))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
