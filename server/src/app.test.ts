import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { apiErrorSchema, healthResponseSchema, jobsResponseSchema } from '@jobs-workspace/shared'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import type { AiClient } from './ai/client'
import { createApp } from './app'
import { parseEnv } from './config/env'

// Satisfies AiClient without ever calling a model: these tests only look at the app's wiring.
const stubAi: AiClient = {
  generateJson: () => Promise.reject(new Error('the model must not be called in these tests')),
}

async function listen(app: ReturnType<typeof createApp>): Promise<{ server: Server; url: string }> {
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  return { server, url: `http://127.0.0.1:${String(port)}` }
}

let unconfigured: { server: Server; url: string }
let configured: { server: Server; url: string }

beforeAll(async () => {
  unconfigured = await listen(createApp())
  configured = await listen(createApp({ ai: stubAi }))
})

afterAll(() => {
  unconfigured.server.close()
  configured.server.close()
})

describe('GET /api/health', () => {
  test('reports aiConfigured false when the app has no AI client', async () => {
    const response = await fetch(`${unconfigured.url}/api/health`)

    expect(response.status).toBe(200)
    expect(healthResponseSchema.parse(await response.json())).toEqual({
      status: 'ok',
      aiConfigured: false,
    })
  })

  test('reports aiConfigured true when the app has an AI client', async () => {
    const response = await fetch(`${configured.url}/api/health`)

    expect(response.status).toBe(200)
    expect(healthResponseSchema.parse(await response.json())).toEqual({
      status: 'ok',
      aiConfigured: true,
    })
  })
})

describe('GET /api/jobs', () => {
  test('serves the seed jobs, validated by the shared schema', async () => {
    const response = await fetch(`${configured.url}/api/jobs`)

    expect(response.status).toBe(200)
    const body = jobsResponseSchema.parse(await response.json())
    expect(body.jobs.map((job) => job.id)).toContain('job-frontend-senior')
  })
})

test('an unknown route answers 404 with the shared error envelope', async () => {
  const response = await fetch(`${unconfigured.url}/api/nope`)

  expect(response.status).toBe(404)
  const body = apiErrorSchema.parse(await response.json())
  expect(body.error.code).toBe('not_found')
})

describe('parseEnv', () => {
  test('gives the defaults for an empty environment', () => {
    const env = parseEnv({})

    expect(env.port).toBe(3001)
    expect(env.geminiApiKey).toBeNull()
    expect(env.geminiBaseUrl).toBeNull()
    expect(env.allowedOrigins).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
    ])
  })

  test('reads the port and the key when they are set', () => {
    const env = parseEnv({ PORT: '3101', GEMINI_API_KEY: 'x' })

    expect(env.port).toBe(3101)
    expect(env.geminiApiKey).not.toBeNull()
  })
})
