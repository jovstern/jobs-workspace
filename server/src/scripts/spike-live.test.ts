import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createGeminiClient } from '../ai/client'
import { parseEnv } from '../config/env'
import { startFakeGemini } from '../test-support/fake-gemini'
import type { FakeGemini } from '../test-support/fake-gemini'
import { configLine, liveRefusal, parseMode, REQUEST_CAP, runSpike } from './spike-live'

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
