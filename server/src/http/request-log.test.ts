import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import type { AiClient } from '../ai/client'
import { createApp } from '../app'

const JOB_ID = 'job-frontend-senior'
const RESUME_MARKER = 'ZEBRA-MARKER-7731'
const MODEL_MARKER = 'MODEL-MARKER-5512'

// Synthetic resume only: an invented person and an invented employer.
const RESUME = [
  'Alex Sample, Frontend Engineer',
  `Built React single page applications for a logistics start-up. ${RESUME_MARKER}`,
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

interface Harness {
  server: Server
  url: string
  lines: string[]
  aiCalls: () => number
}

async function start(): Promise<Harness> {
  const lines: string[] = []
  let calls = 0
  const ai: AiClient = {
    generateJson: (request) => {
      calls += 1
      const ratings = REQUIREMENT_IDS.map((requirementId) => ({
        requirementId,
        // Not evidenced keeps its rationale; a met rating with no quote would be withdrawn (and
        // its rationale dropped) by the quote check, which is not what this test is about.
        rating: 'not_evidenced',
        quote: null,
        rationale: `No evidence found. ${MODEL_MARKER}`,
      }))
      return Promise.resolve(request.schema.parse({ ratings }))
    },
  }
  const app = createApp({ ai, log: (line) => lines.push(line), now: () => 0 })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  return { server, url: `http://127.0.0.1:${String(port)}`, lines, aiCalls: () => calls }
}

let harness: Harness
const consoleSpies = {
  log: vi.spyOn(console, 'log'),
  warn: vi.spyOn(console, 'warn'),
  error: vi.spyOn(console, 'error'),
}

beforeAll(async () => {
  harness = await start()
})

afterAll(() => {
  harness.server.close()
})

beforeEach(() => {
  harness.lines.length = 0
  for (const spy of Object.values(consoleSpies)) spy.mockClear()
})

afterEach(() => {
  // A line is written when the response finishes; give the server a tick to flush it.
  return new Promise((resolve) => setImmediate(resolve))
})

async function post(body: string | undefined): Promise<Response> {
  return fetch(`${harness.url}/api/fit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

async function settled(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20))
}

function consoleText(): string {
  return Object.values(consoleSpies)
    .flatMap((spy) => spy.mock.calls)
    .map((args) => args.map(String).join(' '))
    .join('\n')
}

test('a successful fit request logs exactly one line: method, path, status, duration', async () => {
  const response = await post(JSON.stringify({ jobId: JOB_ID, resumeText: RESUME }))
  await response.text()
  await settled()

  expect(response.status).toBe(200)
  expect(harness.lines).toHaveLength(1)
  expect(harness.lines[0]).toMatch(/^POST \/api\/fit 200 \d+ms$/)
})

test('no log line and no console call contains the resume text or the model output', async () => {
  const response = await post(JSON.stringify({ jobId: JOB_ID, resumeText: RESUME }))
  const text = await response.text()
  await settled()

  // The model answer does reach the browser; it must not reach the log.
  expect(text).toContain(MODEL_MARKER)
  const everything = `${harness.lines.join('\n')}\n${consoleText()}`
  expect(everything).not.toContain(RESUME_MARKER)
  expect(everything).not.toContain(MODEL_MARKER)
})

describe('requests rejected before any AI call', () => {
  test.each([
    ['an empty body', undefined],
    ['empty resume text', JSON.stringify({ jobId: JOB_ID, resumeText: '' })],
    ['missing resume text', JSON.stringify({ jobId: JOB_ID, note: RESUME_MARKER })],
  ])('%s answers 400 with a metadata-only log line', async (_name, body) => {
    const before = harness.aiCalls()

    const response = await post(body)
    const text = await response.text()
    await settled()

    expect(response.status).toBe(400)
    expect(JSON.parse(text)).toMatchObject({ error: { code: 'validation_error' } })
    expect(harness.aiCalls() - before).toBe(0)
    expect(harness.lines).toHaveLength(1)
    expect(harness.lines[0]).toMatch(/^POST \/api\/fit 400 \d+ms$/)
    expect(`${harness.lines.join('\n')}\n${consoleText()}`).not.toContain(RESUME_MARKER)
  })
})

test('the logged path has no query string', async () => {
  const response = await fetch(`${harness.url}/api/health?token=${RESUME_MARKER}`)
  await response.text()
  await settled()

  expect(harness.lines).toHaveLength(1)
  expect(harness.lines[0]).toMatch(/^GET \/api\/health 200 \d+ms$/)
  expect(harness.lines[0]).not.toContain('?')
  expect(harness.lines[0]).not.toContain(RESUME_MARKER)
})
