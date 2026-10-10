import express from 'express'
import { z } from 'zod'

export const healthResponseSchema = z.object({ status: z.literal('ok') })
export type HealthResponse = z.infer<typeof healthResponseSchema>

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok' }
    res.json(body)
  })

  return app
}
