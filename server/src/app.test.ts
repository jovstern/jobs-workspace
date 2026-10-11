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

const JOB_ID = 'job-frontend-senior'
const RESUME = [
  'Alex Sample, Frontend Engineer',
  'Built React single page applications for a logistics start-up over six years.',
  'Wrote TypeScript in strict mode across a shared component package.',
].join('\n')
const REQUIREMENT_IDS = [
  'fe-sr-r1',
  'fe-sr-r2',
  'fe-sr-r3',
  'fe-sr-r4',
  'fe-sr-r5',
  'fe-sr-r6',
  'fe-sr-r7',
  'fe-sr-r8',
]

// Counts calls and answers with valid ratings, so the tests can see whether a request reached
// the model.
function countingAi(): { ai: AiClient; calls: () => number } {
  let calls = 0
  const ai: AiClient = {
    generateJson: (request) => {
      calls += 1
      const ratings = REQUIREMENT_IDS.map((requirementId) => ({
        requirementId,
        rating: 'met',
        quote: null,
        rationale: 'Shown.',
      }))
      return Promise.resolve(request.schema.parse({ ratings }))
    },
  }
  return { ai, calls: () => calls }
}

function postFit(url: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${url}/api/fit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ jobId: JOB_ID, resumeText: RESUME }),
  })
}

describe('guards around the paid route', () => {
  test('with rateLimit max 2 the third fit request answers 429 and the model was called twice', async () => {
    const { ai, calls } = countingAi()
    const limited = await listen(createApp({ ai, rateLimit: { windowMs: 60_000, max: 2 } }))
    try {
      const statuses: number[] = []
      for (let i = 0; i < 3; i += 1) {
        const response = await postFit(limited.url)
        statuses.push(response.status)
        if (response.status === 429) {
          expect(apiErrorSchema.parse(await response.json()).error.code).toBe('too_many_requests')
          expect(response.headers.get('retry-after')).toMatch(/^\d+$/)
        } else {
          await response.text()
        }
      }

      expect(statuses).toEqual([200, 200, 429])
      expect(calls()).toBe(2)
    } finally {
      limited.server.close()
    }
  })

  test('health and jobs are never rate limited', async () => {
    const { ai } = countingAi()
    const limited = await listen(createApp({ ai, rateLimit: { windowMs: 60_000, max: 1 } }))
    try {
      for (let i = 0; i < 4; i += 1) {
        const health = await fetch(`${limited.url}/api/health`)
        const jobs = await fetch(`${limited.url}/api/jobs`)
        await health.text()
        await jobs.text()
        expect(health.status).toBe(200)
        expect(jobs.status).toBe(200)
      }
    } finally {
      limited.server.close()
    }
  })

  test('a fit request from another origin answers 403 and the model is not called', async () => {
    const { ai, calls } = countingAi()
    const guarded = await listen(createApp({ ai }))
    try {
      const response = await postFit(guarded.url, { origin: 'https://evil.example' })

      expect(response.status).toBe(403)
      expect(apiErrorSchema.parse(await response.json()).error.code).toBe('forbidden_origin')
      expect(calls()).toBe(0)
    } finally {
      guarded.server.close()
    }
  })

  test('a refused foreign origin does not use up the rate limit', async () => {
    const { ai, calls } = countingAi()
    const limited = await listen(createApp({ ai, rateLimit: { windowMs: 60_000, max: 1 } }))
    try {
      const foreign = await postFit(limited.url, { origin: 'https://evil.example' })
      await foreign.text()
      const own = await postFit(limited.url)
      await own.text()

      expect(foreign.status).toBe(403)
      expect(own.status).toBe(200)
      expect(calls()).toBe(1)
    } finally {
      limited.server.close()
    }
  })
})
