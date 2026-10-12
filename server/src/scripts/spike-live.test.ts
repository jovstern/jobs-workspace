import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createGeminiClient } from '../ai/client'
import { parseEnv } from '../config/env'
import { startFakeGemini } from '../test-support/fake-gemini'
import type { FakeGemini } from '../test-support/fake-gemini'
import {
  ADVICE_REQUEST_CAP,
  ADVICE_RUNS_PER_PAIR,
  configLine,
  liveRefusal,
  PAIRS,
  parseMode,
  recommendSettings,
  REQUEST_CAP,
  runAdviceCheck,
  runSpike,
  schemaVerdict,
  SMOKE_REQUEST_CAP,
  summariseAdviceCheck,
  USAGE,
} from './spike-live'
import type { AiUsage } from '../ai/client'
import type { AdviceCheckRow } from './spike-live'

const resumeText = readFileSync(
  fileURLToPath(new URL('../../../e2e/fixtures/resumes/frontend-senior.txt', import.meta.url)),
  'utf8',
)

// Every sentence of the fixture that is long enough to be identifying.
const fixtureSentences = resumeText
  .split(/\n|(?<=\.)\s/)
  .map((line) => line.trim())
  .filter((line) => line.length >= 25)

test('the fixture yields sentences to check output against', () => {
  expect(fixtureSentences.length).toBeGreaterThan(10)
})

let fake: FakeGemini

beforeAll(async () => {
  fake = await startFakeGemini()
})

afterAll(async () => {
  await fake.close()
})

function client() {
  return createGeminiClient({ apiKey: 'test-key', baseUrl: fake.url })
}

describe('runSpike against the stand-in model', () => {
  test('runs one pass per level and pair, then the extra runs, and reports every level and pair', async () => {
    fake.reset()
    const lines: string[] = []
    const summary = await runSpike({
      ai: client(),
      resumeText,
      mode: 'dry-run',
      log: (line) => lines.push(line),
    })

    expect(summary.requestsSent).toBe(22)
    expect(fake.requestCount()).toBe(22)
    expect(summary.levels.map((level) => level.level)).toEqual(['LOW', 'MEDIUM', 'HIGH'])
    expect(new Set(summary.cells.map((cell) => cell.pair))).toEqual(
      new Set(['near-perfect', 'poor']),
    )
    expect(summary.cells).toHaveLength(6)
    expect(summary.estimatedSpendUsd).toBeNull()
    expect(summary.stoppedEarly).toBe(false)

    const output = JSON.stringify(summary) + lines.join('\n')
    for (const sentence of fixtureSentences) expect(output).not.toContain(sentence)
    expect(output).not.toContain('test-key')
    expect(output).not.toContain('example.com')
  })

  test('sends the spike limits and the level it is measuring on every request', async () => {
    fake.reset()
    await runSpike({ ai: client(), resumeText, mode: 'dry-run', requestCap: 1 })
    const body = fake.lastRequest()?.body as {
      generationConfig?: { thinkingConfig?: { thinkingLevel?: string }; maxOutputTokens?: number }
    } | null
    expect(body?.generationConfig?.thinkingConfig?.thinkingLevel).toBe('LOW')
    expect(body?.generationConfig?.maxOutputTokens).toBe(16384)
  })

  test('never sends more requests than the cap', async () => {
    fake.reset()
    const summary = await runSpike({ ai: client(), resumeText, mode: 'dry-run', requestCap: 5 })
    expect(summary.requestsSent).toBe(5)
    expect(fake.requestCount()).toBe(5)
    expect(summary.stoppedEarly).toBe(true)
  })

  test('the cap is 30', () => {
    expect(REQUEST_CAP).toBe(30)
  })

  test('records a failure as a row, does not retry, and stops after three failures in a row', async () => {
    fake.reset()
    fake.setScenario('http_503')
    const summary = await runSpike({ ai: client(), resumeText, mode: 'dry-run' })
    expect(summary.requestsSent).toBe(3)
    expect(fake.requestCount()).toBe(3)
    expect(summary.stoppedEarly).toBe(true)
    expect(summary.rows.every((row) => !row.ok && row.errorCode === 'ai_overloaded')).toBe(true)
    expect(summary.chosenLevel).toBeNull()
    expect(summary.recommendedMaxOutputTokens).toBeNull()
    expect(summary.recommendedDeadlineMs).toBeNull()
    fake.reset()
  })

  test('a failed row carries only the status and category, in the rows and the progress lines', async () => {
    fake.reset()
    fake.setScenario('http_429')
    const lines: string[] = []
    const summary = await runSpike({
      ai: client(),
      resumeText,
      mode: 'dry-run',
      log: (line) => lines.push(line),
    })
    for (const row of summary.rows) {
      expect(row.failure).toMatchObject({ httpStatus: 429, category: 'RESOURCE_EXHAUSTED' })
    }
    expect(lines[0]).toContain('429')
    expect(lines[0]).toContain('RESOURCE_EXHAUSTED')
    const output = JSON.stringify(summary) + lines.join('\n')
    expect(output).not.toContain('Quota exceeded')
    for (const sentence of fixtureSentences) expect(output).not.toContain(sentence)
    fake.reset()
  })

  test('a successful row has no failure', async () => {
    fake.reset()
    const summary = await runSpike({ ai: client(), resumeText, mode: 'dry-run', requestCap: 1 })
    expect(summary.rows[0]?.failure).toBeNull()
  })
})

describe('modes and refusals', () => {
  test('parseMode accepts only the three flags, and a live run needs --live', () => {
    expect(parseMode(['--live'])).toBe('live')
    expect(parseMode(['--check-config'])).toBe('check-config')
    expect(parseMode(['--dry-run'])).toBe('dry-run')
    expect(parseMode([])).toBeNull()
    expect(parseMode(['--dryrun'])).toBeNull()
    expect(parseMode(['live'])).toBeNull()
    expect(parseMode(['--dry-run', '--check-config'])).toBeNull()
    expect(parseMode(['--live', '--dry-run'])).toBeNull()
  })

  describe('the script itself', () => {
    const script = fileURLToPath(new URL('./spike-live.ts', import.meta.url))

    // Runs the real entry point. Only argument sets that must stop before any environment is read
    // are run, so nothing here can reach Google. The stand-in is the only base URL and no key is
    // given.
    function run(args: readonly string[]) {
      return spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
        encoding: 'utf8',
        env: { PATH: process.env.PATH ?? '', GEMINI_BASE_URL: fake.url },
      })
    }

    test('with no argument it prints usage, exits non-zero and sends nothing', () => {
      const before = fake.requestCount()

      const result = run([])

      expect(result.status).toBe(2)
      expect(result.stderr).toContain('usage:')
      expect(result.stderr).toContain('--live')
      expect(result.stdout).toBe('')
      expect(fake.requestCount() - before).toBe(0)
    })

    test('with an unknown argument it does the same', () => {
      const before = fake.requestCount()

      const result = run(['--liv'])

      expect(result.status).toBe(2)
      expect(result.stderr).toContain('usage:')
      expect(fake.requestCount() - before).toBe(0)
    })
  })

  test('configLine is a single boolean line', () => {
    expect(configLine(parseEnv({ GEMINI_API_KEY: 'k' }))).toBe('aiConfigured: true')
    expect(configLine(parseEnv({}))).toBe('aiConfigured: false')
  })

  test('a live run is refused without a key and when the base URL is set', () => {
    expect(liveRefusal(parseEnv({}))).toMatch(/no AI key/)
    expect(liveRefusal(parseEnv({ GEMINI_API_KEY: 'k', GEMINI_BASE_URL: 'http://x' }))).toMatch(
      /GEMINI_BASE_URL/,
    )
    expect(liveRefusal(parseEnv({ GEMINI_API_KEY: 'k' }))).toBeNull()
  })

  test('a refusal never contains the key or the base URL', () => {
    const refusal = liveRefusal(
      parseEnv({ GEMINI_API_KEY: 'secret-key', GEMINI_BASE_URL: 'http://leak' }),
    )
    expect(refusal).not.toContain('secret-key')
    expect(refusal).not.toContain('http://leak')
  })
})

const noAdvice = {
  plansReceived: 0,
  plansKept: 0,
  stepsDropped: 0,
  tipsReceived: 0,
  tipsKept: 0,
  keywordsReceived: 0,
  keywordsKept: 0,
  tailoringUsable: false,
}

function usageOf(thoughtTokens: number, outputTokens: number): AiUsage {
  return {
    promptTokens: 3000,
    thoughtTokens,
    outputTokens,
    totalTokens: 3000 + thoughtTokens + outputTokens,
    finishReason: 'STOP',
    latencyMs: 1000,
  }
}

function okRow(overrides: Partial<AdviceCheckRow> = {}): AdviceCheckRow {
  return {
    pair: 'poor',
    ok: true,
    errorCode: null,
    failure: null,
    wallMs: 1000,
    usage: usageOf(400, 1500),
    gaps: 5,
    quoteRejected: 0,
    advice: { ...noAdvice, plansReceived: 5, plansKept: 5, tailoringUsable: true },
    ...overrides,
  }
}

function failedRow(status: number | null, category: 'INVALID_ARGUMENT' | 'UNAVAILABLE') {
  return okRow({
    ok: false,
    errorCode: 'ai_failed',
    failure: { httpStatus: status, category, errorClass: 'ApiError' },
    usage: null,
    gaps: null,
    quoteRejected: null,
    advice: null,
  })
}

function checkOutput(summary: unknown, lines: readonly string[]): void {
  const output = JSON.stringify(summary) + lines.join('\n')
  for (const sentence of fixtureSentences) expect(output).not.toContain(sentence)
  expect(output).not.toContain('test-key')
  expect(output).not.toContain('example.com')
}

function stringValues(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringValues)
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(stringValues)
  return []
}

describe('the request caps', () => {
  test('the smoke call is one request and the measurement is at most ten', () => {
    expect(SMOKE_REQUEST_CAP).toBe(1)
    expect(ADVICE_REQUEST_CAP).toBe(10)
    expect(ADVICE_RUNS_PER_PAIR).toBe(4)
    expect(ADVICE_RUNS_PER_PAIR * PAIRS.length).toBeLessThanOrEqual(ADVICE_REQUEST_CAP)
  })

  test('the usage text says how many paid requests each live mode sends', () => {
    expect(USAGE).toContain('--smoke')
    expect(USAGE).toContain('1 paid request')
    expect(USAGE).toContain('--advice')
    expect(USAGE).toContain('8 paid requests')
  })
})

describe('parseMode for the advice checks', () => {
  test('accepts the four new flags, each only as the single argument', () => {
    expect(parseMode(['--smoke'])).toBe('smoke')
    expect(parseMode(['--advice'])).toBe('advice')
    expect(parseMode(['--dry-run-smoke'])).toBe('dry-run-smoke')
    expect(parseMode(['--dry-run-advice'])).toBe('dry-run-advice')
  })

  test('two flags together, a typo and no flag are all null', () => {
    expect(parseMode(['--smoke', '--advice'])).toBeNull()
    expect(parseMode(['--smoke', '--dry-run'])).toBeNull()
    expect(parseMode(['--live', '--advice'])).toBeNull()
    expect(parseMode(['--smok'])).toBeNull()
    expect(parseMode(['--dry-run-advise'])).toBeNull()
    expect(parseMode(['smoke'])).toBeNull()
    expect(parseMode([])).toBeNull()
  })
})

describe('runAdviceCheck against the stand-in model', () => {
  test('the smoke plan sends exactly one request, for the poor pair, at the shipped settings', async () => {
    fake.reset()
    const lines: string[] = []
    const summary = await runAdviceCheck({
      ai: client(),
      resumeText,
      mode: 'dry-run',
      plan: 'smoke',
      log: (line) => lines.push(line),
    })

    expect(summary.requestsSent).toBe(1)
    expect(fake.requestCount()).toBe(1)
    expect(summary.requestCap).toBe(1)
    expect(summary.plan).toBe('smoke')
    expect(summary.rows.map((row) => row.pair)).toEqual(['poor'])
    expect(summary.schemaAccepted).toBe(true)
    expect(summary.splitRecommended).toBeNull()
    const body = fake.lastRequest()?.body as {
      generationConfig?: { thinkingConfig?: { thinkingLevel?: string }; maxOutputTokens?: number }
    } | null
    expect(body?.generationConfig?.maxOutputTokens).toBe(8192)
    expect(body?.generationConfig?.thinkingConfig?.thinkingLevel).toBe('LOW')
    checkOutput(summary, lines)
  })

  test('the advice plan sends four requests per pair, eight in all, at LOW with the spike limits', async () => {
    fake.reset()
    const lines: string[] = []
    const summary = await runAdviceCheck({
      ai: client(),
      resumeText,
      mode: 'dry-run',
      plan: 'advice',
      log: (line) => lines.push(line),
    })

    expect(summary.requestsSent).toBe(8)
    expect(fake.requestCount()).toBe(8)
    expect(summary.requestCap).toBe(10)
    expect(summary.stoppedEarly).toBe(false)
    expect(summary.rows.filter((row) => row.pair === 'near-perfect')).toHaveLength(4)
    expect(summary.rows.filter((row) => row.pair === 'poor')).toHaveLength(4)
    expect(summary.schemaAccepted).toBe(true)
    expect(summary.estimatedSpendUsd).toBeNull()
    expect(summary.mode).toBe('dry-run')
    const body = fake.lastRequest()?.body as {
      generationConfig?: { thinkingConfig?: { thinkingLevel?: string }; maxOutputTokens?: number }
    } | null
    expect(body?.generationConfig?.maxOutputTokens).toBe(16384)
    expect(body?.generationConfig?.thinkingConfig?.thinkingLevel).toBe('LOW')
    checkOutput(summary, lines)
  })

  test('a successful row carries the advice counts as numbers and a boolean, the gaps and the rejected quotes', async () => {
    fake.reset()
    const summary = await runAdviceCheck({
      ai: client(),
      resumeText,
      mode: 'dry-run',
      plan: 'smoke',
    })
    const row = summary.rows[0]
    expect(row?.ok).toBe(true)
    expect(typeof row?.gaps).toBe('number')
    expect(row?.gaps).toBeGreaterThan(0)
    expect(row?.quoteRejected).toBe(0)
    expect(row?.advice).not.toBeNull()
    for (const key of [
      'plansReceived',
      'plansKept',
      'stepsDropped',
      'tipsReceived',
      'tipsKept',
      'keywordsReceived',
      'keywordsKept',
    ] as const) {
      expect(typeof row?.advice?.[key]).toBe('number')
    }
    expect(typeof row?.advice?.tailoringUsable).toBe('boolean')
    expect(row?.usage).not.toBeNull()
  })

  test('a failure is a row, is never retried, and three failures in a row stop the measurement', async () => {
    fake.reset()
    fake.setScenario('http_503')
    const summary = await runAdviceCheck({
      ai: client(),
      resumeText,
      mode: 'dry-run',
      plan: 'advice',
    })
    expect(summary.requestsSent).toBe(3)
    expect(fake.requestCount()).toBe(3)
    expect(summary.stoppedEarly).toBe(true)
    expect(summary.rows.every((row) => !row.ok && row.errorCode === 'ai_overloaded')).toBe(true)
    expect(summary.schemaAccepted).toBeNull()
    expect(summary.p50LatencyMs).toBeNull()
    expect(summary.p90LatencyMs).toBeNull()
    expect(summary.recommendedMaxOutputTokens).toBeNull()
    expect(summary.recommendedDeadlineMs).toBeNull()
    expect(summary.splitRecommended).toBeNull()
    fake.reset()
  })

  test('a failed smoke call is one row and is not retried', async () => {
    fake.reset()
    fake.setScenario('http_429')
    const lines: string[] = []
    const summary = await runAdviceCheck({
      ai: client(),
      resumeText,
      mode: 'dry-run',
      plan: 'smoke',
      log: (line) => lines.push(line),
    })
    expect(summary.requestsSent).toBe(1)
    expect(fake.requestCount()).toBe(1)
    expect(summary.rows[0]?.failure).toMatchObject({
      httpStatus: 429,
      category: 'RESOURCE_EXHAUSTED',
    })
    expect(summary.schemaAccepted).toBeNull()
    expect(lines.join('\n')).toContain('RESOURCE_EXHAUSTED')
    checkOutput(summary, lines)
    fake.reset()
  })

  test('no string value in either summary contains a space', async () => {
    for (const plan of ['smoke', 'advice'] as const) {
      fake.reset()
      const summary = await runAdviceCheck({ ai: client(), resumeText, mode: 'dry-run', plan })
      for (const text of stringValues(summary)) expect(text).not.toContain(' ')
    }
    fake.reset()
    fake.setScenario('http_503')
    const failed = await runAdviceCheck({
      ai: client(),
      resumeText,
      mode: 'dry-run',
      plan: 'advice',
    })
    for (const text of stringValues(failed)) expect(text).not.toContain(' ')
    fake.reset()
  })
})

describe('schemaVerdict', () => {
  test('is true when at least one row succeeded, even beside failures', () => {
    expect(schemaVerdict([okRow()])).toBe(true)
    expect(schemaVerdict([failedRow(400, 'INVALID_ARGUMENT'), okRow()])).toBe(true)
  })

  test('is false only when every row failed with status 400 and category INVALID_ARGUMENT', () => {
    expect(schemaVerdict([failedRow(400, 'INVALID_ARGUMENT')])).toBe(false)
    expect(
      schemaVerdict([failedRow(400, 'INVALID_ARGUMENT'), failedRow(400, 'INVALID_ARGUMENT')]),
    ).toBe(false)
  })

  test('is null for any other failure, a mix of failures, and no rows', () => {
    expect(schemaVerdict([failedRow(503, 'UNAVAILABLE')])).toBeNull()
    expect(
      schemaVerdict([failedRow(400, 'INVALID_ARGUMENT'), failedRow(503, 'UNAVAILABLE')]),
    ).toBeNull()
    expect(schemaVerdict([failedRow(null, 'INVALID_ARGUMENT')])).toBeNull()
    expect(schemaVerdict([])).toBeNull()
  })
})

describe('recommendSettings', () => {
  test('never goes below 8192 tokens or 45000 ms', () => {
    expect(recommendSettings(100, 100)).toEqual({ maxOutputTokens: 8192, deadlineMs: 45000 })
    expect(recommendSettings(3000, 16000)).toEqual({ maxOutputTokens: 8192, deadlineMs: 50000 })
  })

  test('raises the cap with the largest count seen, and never lets the deadline pass 55000 ms', () => {
    expect(recommendSettings(5000, 30000)).toEqual({ maxOutputTokens: 10240, deadlineMs: 55000 })
    expect(recommendSettings(20000, 40000)).toEqual({ maxOutputTokens: 16384, deadlineMs: 55000 })
  })
})

describe('summariseAdviceCheck', () => {
  const base = { mode: 'live', requestCap: 10, stoppedEarly: false } as const

  test('latency is taken over successful calls only, and the recommendations follow the rule', () => {
    const summary = summariseAdviceCheck({
      ...base,
      plan: 'advice',
      rows: [
        okRow({ wallMs: 9000 }),
        okRow({
          wallMs: 11000,
          usage: usageOf(600, 2400),
        }),
        okRow({ wallMs: 13000 }),
        failedRow(503, 'UNAVAILABLE'),
      ],
    })
    expect(summary.requestsSent).toBe(4)
    expect(summary.p50LatencyMs).toBe(11000)
    expect(summary.p90LatencyMs).toBe(13000)
    expect(summary.maxThoughtPlusOutputTokens).toBe(3000)
    expect(summary.meanThoughtTokens).toBe(467)
    expect(summary.recommendedMaxOutputTokens).toBe(8192)
    expect(summary.recommendedDeadlineMs).toBe(45000)
    expect(summary.splitRecommended).toBe(false)
    expect(summary.schemaAccepted).toBe(true)
    expect(summary.estimatedSpendUsd).not.toBeNull()
  })

  test('recommends considering a split only when the p90 is above 15000 ms', () => {
    const slow = summariseAdviceCheck({
      ...base,
      plan: 'advice',
      rows: [okRow({ wallMs: 14000 }), okRow({ wallMs: 15001 })],
    })
    expect(slow.splitRecommended).toBe(true)
    const edge = summariseAdviceCheck({
      ...base,
      plan: 'advice',
      rows: [okRow({ wallMs: 14000 }), okRow({ wallMs: 15000 })],
    })
    expect(edge.splitRecommended).toBe(false)
  })

  test('counts gaps left without a plan and answers with no usable tailoring', () => {
    const summary = summariseAdviceCheck({
      ...base,
      plan: 'advice',
      rows: [
        okRow({ gaps: 5, advice: { ...noAdvice, plansKept: 3, tailoringUsable: true } }),
        okRow({ gaps: 2, advice: { ...noAdvice, plansKept: 2, tailoringUsable: false } }),
        okRow({ gaps: 1, advice: { ...noAdvice, plansKept: 0, tailoringUsable: false } }),
      ],
    })
    expect(summary.gapsWithoutPlan).toBe(3)
    expect(summary.tailoringUnusable).toBe(2)
  })

  test('the smoke plan never recommends a split, and a dry run reports no spend', () => {
    const summary = summariseAdviceCheck({
      mode: 'dry-run',
      plan: 'smoke',
      requestCap: 1,
      stoppedEarly: false,
      rows: [okRow({ wallMs: 30000 })],
    })
    expect(summary.splitRecommended).toBeNull()
    expect(summary.estimatedSpendUsd).toBeNull()
  })
})

describe('the script and the new modes', () => {
  const script = fileURLToPath(new URL('./spike-live.ts', import.meta.url))

  function run(args: readonly string[], env: Record<string, string>) {
    return spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH ?? '', ...env },
    })
  }

  test('--dry-run-smoke needs no key, sends one request to its own stand-in and ends with dry-run complete', () => {
    const result = run(['--dry-run-smoke'], {})
    expect(result.status).toBe(0)
    expect(result.stdout.trim().endsWith('dry-run complete')).toBe(true)
    const json = result.stdout.slice(0, result.stdout.lastIndexOf('dry-run complete'))
    expect((JSON.parse(json) as { requestsSent: number }).requestsSent).toBe(1)
  }, 30000)

  test('--dry-run-advice needs no key, sends eight requests to its own stand-in and ends with dry-run complete', () => {
    const result = run(['--dry-run-advice'], {})
    expect(result.status).toBe(0)
    expect(result.stdout.trim().endsWith('dry-run complete')).toBe(true)
    const json = result.stdout.slice(0, result.stdout.lastIndexOf('dry-run complete'))
    expect((JSON.parse(json) as { requestsSent: number }).requestsSent).toBe(8)
  }, 30000)

  test('the live modes are refused with exit code 2 and no request when the stand-in address is set', () => {
    for (const flag of ['--smoke', '--advice']) {
      const before = fake.requestCount()
      const result = run([flag], { GEMINI_BASE_URL: fake.url, GEMINI_API_KEY: 'test-key' })
      expect(result.status).toBe(2)
      expect(result.stderr).toContain('GEMINI_BASE_URL')
      expect(result.stdout).toBe('')
      expect(fake.requestCount() - before).toBe(0)
    }
  }, 30000)

  test('the live modes are refused with exit code 2 when no key is configured', () => {
    for (const flag of ['--smoke', '--advice']) {
      // An empty value in the process environment wins over server/.env, so no key is configured
      // whatever that file holds, and nothing can reach Google.
      const result = run([flag], { GEMINI_API_KEY: '' })
      expect(result.status).toBe(2)
      expect(result.stderr).toContain('no AI key')
      expect(result.stdout).toBe('')
    }
  }, 30000)
})
