// The live-call spike (plan 01-09). It measures the fit call against Google's real model through
// analyzeFit, the same code path the route uses, and prints numbers only.
//
//   npm --prefix server run spike:live -- --check-config   prints whether a key is configured
//   npm --prefix server run spike:live -- --dry-run        rehearses against the stand-in, no key
//   npm --prefix server run spike:live                      LIVE: paid calls, run it by hand, once
//
// It is not part of `npm run check`, the server check or the browser tests, and no gate runs it.
// It sends only the committed synthetic resume, makes at most REQUEST_CAP requests and never
// retries. Its output holds ids, enum values and numbers: no resume text, no quote, no rationale,
// no prompt and no key.
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { Rating } from '@jobs-workspace/shared'

import { createGeminiClient } from '../ai/client'
import type { AiClient, AiUsage } from '../ai/client'
import type { AiFailureDiagnostic } from '../ai/diagnose'
import { loadServerEnv } from '../config/env'
import type { Env } from '../config/env'
import { MODELS } from '../config/models'
import type { ThinkingLevelName } from '../config/models'
import { AppError } from '../http/errors'
import { analyzeFit } from '../fit/analyze'
import { getJob } from '../jobs/seed'
import {
  chooseThinkingLevel,
  countRatingFlips,
  estimateSpendUsd,
  percentile,
  recommendDeadlineMs,
  recommendMaxOutputTokens,
  THINKING_LEVEL_ORDER,
} from './spike-stats'
import type { LevelMeasurement, Prices } from './spike-stats'

// A hard stop on paid requests, whatever happens. The planned run is 22.
export const REQUEST_CAP = 30
const RUNS_PER_LEVEL_AND_PAIR = 3
const EXTRA_RUNS_PER_PAIR = 2
// Stop early when this many calls in a row fail: a bad key or an exhausted quota fails every call.
const MAX_CONSECUTIVE_FAILURES = 3
// The spike measures what the model uses, so its own limits are the loosest the app would allow.
const SPIKE_MAX_OUTPUT_TOKENS = 16384
const SPIKE_DEADLINE_MS = 60000
// US dollars per million tokens for gemini-3.8-flash (intro price through 2026-12-31, from
// 01-RESEARCH.md A.3). Output includes thinking tokens. An estimate, not a bill.
const PRICES: Prices = { input: 0.75, output: 3.75 }

const RESUME_PATH = fileURLToPath(
  new URL('../../../e2e/fixtures/resumes/frontend-senior.txt', import.meta.url),
)

export const PAIRS = [
  { name: 'near-perfect', jobId: 'job-frontend-senior' },
  { name: 'poor', jobId: 'job-data-scientist-senior' },
] as const
export type PairName = (typeof PAIRS)[number]['name']

export interface CallRow {
  level: ThinkingLevelName
  pair: PairName
  ok: boolean
  errorCode: string | null
  // Status number and category of a failed call, from a fixed list. Never any text.
  failure: AiFailureDiagnostic | null
  wallMs: number
  usage: AiUsage | null
  requiredMet: number | null
  quoteRejected: number | null
}

interface CallRecord {
  row: CallRow
  ratings: Rating[] | null
}

export interface CellSummary {
  level: ThinkingLevelName
  pair: PairName
  calls: number
  failures: number
  p50LatencyMs: number | null
  p90LatencyMs: number | null
  meanPromptTokens: number | null
  meanThoughtTokens: number | null
  meanOutputTokens: number | null
  maxThoughtPlusOutputTokens: number | null
  requiredMetPerRun: number[]
  ratingFlips: number
  rejectedQuotes: number
}

export interface LevelSummary {
  level: ThinkingLevelName
  calls: number
  failures: number
  p50LatencyMs: number | null
  p90LatencyMs: number | null
  maxThoughtPlusOutputTokens: number | null
  averageFlipsPerPair: number
}

export interface SpikeSummary {
  mode: 'dry-run' | 'live'
  model: string
  requestCap: number
  requestsSent: number
  stoppedEarly: boolean
  cells: CellSummary[]
  levels: LevelSummary[]
  rows: CallRow[]
  chosenBeforeExtras: ThinkingLevelName | null
  extrasRanAt: ThinkingLevelName
  chosenLevel: ThinkingLevelName | null
  recommendedMaxOutputTokens: number | null
  recommendedDeadlineMs: number | null
  totalPromptTokens: number
  totalOutputTokensIncludingThoughts: number
  estimatedSpendUsd: number | null
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function percentileOrNull(values: readonly number[], p: number): number | null {
  return values.length === 0 ? null : percentile(values, p)
}

function thoughtPlusOutput(usage: AiUsage): number {
  return usage.thoughtTokens + usage.outputTokens
}

// A failed call in a progress line: the typed code, then the status and category when known.
function failureText(row: CallRow): string {
  const code = row.errorCode ?? 'failed'
  if (row.failure === null) return code
  const status = row.failure.httpStatus === null ? 'no-http-status' : String(row.failure.httpStatus)
  const errorClass = row.failure.errorClass === null ? '' : ` ${row.failure.errorClass}`
  return `${code} ${status} ${row.failure.category}${errorClass}`
}

function pairOf(name: PairName) {
  const found = PAIRS.find((pair) => pair.name === name)
  if (found === undefined) throw new Error('unknown pair')
  return found
}

function flipsFor(records: readonly CallRecord[], level: ThinkingLevelName, pair: PairName) {
  const runs = records
    .filter((record) => record.row.level === level && record.row.pair === pair)
    .flatMap((record) => (record.ratings === null ? [] : [record.ratings]))
  return countRatingFlips(runs)
}

function measurementsFrom(records: readonly CallRecord[]): LevelMeasurement[] {
  return THINKING_LEVEL_ORDER.flatMap((level): LevelMeasurement[] => {
    const atLevel = records.filter((record) => record.row.level === level)
    if (atLevel.length === 0) return []
    const latencies = atLevel.map((record) => record.row.wallMs)
    const metFor = (pair: PairName) =>
      atLevel.flatMap((record) =>
        record.row.pair === pair && record.row.requiredMet !== null ? [record.row.requiredMet] : [],
      )
    return [
      {
        level,
        p90LatencyMs: percentile(latencies, 90),
        failures: atLevel.filter((record) => !record.row.ok).length,
        nearRequiredMet: metFor('near-perfect'),
        poorRequiredMet: metFor('poor'),
        averageFlipsPerPair:
          PAIRS.reduce((sum, pair) => sum + flipsFor(records, level, pair.name), 0) / PAIRS.length,
      },
    ]
  })
}

export interface SpikeOptions {
  ai: AiClient
  resumeText: string
  mode: 'dry-run' | 'live'
  requestCap?: number
  // Progress lines: level, pair, outcome and milliseconds only.
  log?: (line: string) => void
}

export async function runSpike(options: SpikeOptions): Promise<SpikeSummary> {
  const { ai, resumeText, mode } = options
  const requestCap = options.requestCap ?? REQUEST_CAP
  const log = options.log ?? (() => undefined)
  const records: CallRecord[] = []
  let consecutiveFailures = 0
  let stoppedEarly = false

  // Every paid request goes through here, so the cap and the no-retry rule hold in one place.
  async function callOnce(level: ThinkingLevelName, pairName: PairName): Promise<void> {
    if (stoppedEarly) return
    if (records.length >= requestCap || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      stoppedEarly = true
      return
    }
    const job = getJob(pairOf(pairName).jobId)
    if (job === undefined) throw new Error('seed job missing')
    let usage: AiUsage | null = null
    let failure: AiFailureDiagnostic | null = null
    const startedAt = performance.now()
    let record: CallRecord
    try {
      const response = await analyzeFit({
        ai,
        job,
        resumeText,
        signal: new AbortController().signal,
        now: () => Date.now(),
        overrides: {
          thinking: level,
          maxOutputTokens: SPIKE_MAX_OUTPUT_TOKENS,
          deadlineMs: SPIKE_DEADLINE_MS,
        },
        onUsage: (reported) => {
          usage = reported
        },
        onFailure: (reported) => {
          failure = reported
        },
      })
      const kindOf = new Map(
        job.requirements.map((requirement) => [requirement.id, requirement.kind]),
      )
      record = {
        ratings: response.ratings.map((rated) => rated.rating),
        row: {
          level,
          pair: pairName,
          ok: true,
          errorCode: null,
          failure: null,
          wallMs: Math.round(performance.now() - startedAt),
          usage,
          requiredMet: response.ratings.filter(
            (rated) => rated.rating === 'met' && kindOf.get(rated.requirementId) === 'required',
          ).length,
          quoteRejected: response.ratings.filter((rated) => rated.quoteRejected).length,
        },
      }
      consecutiveFailures = 0
    } catch (error) {
      record = {
        ratings: null,
        row: {
          level,
          pair: pairName,
          ok: false,
          errorCode: error instanceof AppError ? error.code : 'unexpected_error',
          failure,
          wallMs: Math.round(performance.now() - startedAt),
          usage,
          requiredMet: null,
          quoteRejected: null,
        },
      }
      consecutiveFailures += 1
    }
    records.push(record)
    log(
      `[${String(records.length)}/${String(requestCap)}] ${level} ${pairName} ${
        record.row.ok ? 'ok' : failureText(record.row)
      } ${String(record.row.wallMs)}ms`,
    )
  }

  for (const level of THINKING_LEVEL_ORDER) {
    for (let run = 0; run < RUNS_PER_LEVEL_AND_PAIR; run += 1) {
      for (const pair of PAIRS) await callOnce(level, pair.name)
    }
  }

  const chosenBeforeExtras = chooseThinkingLevel(measurementsFrom(records))
  const extrasRanAt = chosenBeforeExtras ?? 'LOW'
  for (let run = 0; run < EXTRA_RUNS_PER_PAIR; run += 1) {
    for (const pair of PAIRS) await callOnce(extrasRanAt, pair.name)
  }

  const measurements = measurementsFrom(records)
  const chosenLevel = chooseThinkingLevel(measurements)

  const cells: CellSummary[] = THINKING_LEVEL_ORDER.flatMap((level) =>
    PAIRS.flatMap((pair): CellSummary[] => {
      const cell = records.filter(
        (record) => record.row.level === level && record.row.pair === pair.name,
      )
      if (cell.length === 0) return []
      const latencies = cell.map((record) => record.row.wallMs)
      const usages = cell.flatMap((record) => (record.row.usage === null ? [] : [record.row.usage]))
      return [
        {
          level,
          pair: pair.name,
          calls: cell.length,
          failures: cell.filter((record) => !record.row.ok).length,
          p50LatencyMs: percentile(latencies, 50),
          p90LatencyMs: percentile(latencies, 90),
          meanPromptTokens: mean(usages.map((usage) => usage.promptTokens)),
          meanThoughtTokens: mean(usages.map((usage) => usage.thoughtTokens)),
          meanOutputTokens: mean(usages.map((usage) => usage.outputTokens)),
          maxThoughtPlusOutputTokens:
            usages.length === 0 ? null : Math.max(...usages.map(thoughtPlusOutput)),
          requiredMetPerRun: cell.flatMap((record) =>
            record.row.requiredMet === null ? [] : [record.row.requiredMet],
          ),
          ratingFlips: flipsFor(records, level, pair.name),
          rejectedQuotes: cell.reduce((sum, record) => sum + (record.row.quoteRejected ?? 0), 0),
        },
      ]
    }),
  )

  function usagesAt(level: ThinkingLevelName): AiUsage[] {
    return records.flatMap((record) =>
      record.row.level === level && record.row.usage !== null ? [record.row.usage] : [],
    )
  }

  const levels: LevelSummary[] = measurements.map((measurement) => {
    const atLevel = records.filter((record) => record.row.level === measurement.level)
    const latencies = atLevel.map((record) => record.row.wallMs)
    const usages = usagesAt(measurement.level)
    return {
      level: measurement.level,
      calls: atLevel.length,
      failures: measurement.failures,
      p50LatencyMs: percentileOrNull(latencies, 50),
      p90LatencyMs: percentileOrNull(latencies, 90),
      maxThoughtPlusOutputTokens:
        usages.length === 0 ? null : Math.max(...usages.map(thoughtPlusOutput)),
      averageFlipsPerPair: measurement.averageFlipsPerPair,
    }
  })

  const chosenSummary = levels.find((summary) => summary.level === chosenLevel)
  const allUsages = records.flatMap((record) =>
    record.row.usage === null ? [] : [record.row.usage],
  )
  const totalPromptTokens = allUsages.reduce((sum, usage) => sum + usage.promptTokens, 0)
  const totalOutputTokens = allUsages.reduce((sum, usage) => sum + thoughtPlusOutput(usage), 0)

  return {
    mode,
    model: MODELS.fit.id,
    requestCap,
    requestsSent: records.length,
    stoppedEarly,
    cells,
    levels,
    rows: records.map((record) => record.row),
    chosenBeforeExtras,
    extrasRanAt,
    chosenLevel,
    recommendedMaxOutputTokens:
      chosenSummary?.maxThoughtPlusOutputTokens == null
        ? null
        : recommendMaxOutputTokens(chosenSummary.maxThoughtPlusOutputTokens),
    recommendedDeadlineMs:
      chosenSummary?.p90LatencyMs == null ? null : recommendDeadlineMs(chosenSummary.p90LatencyMs),
    totalPromptTokens,
    totalOutputTokensIncludingThoughts: totalOutputTokens,
    estimatedSpendUsd:
      mode === 'dry-run'
        ? null
        : Number(
            estimateSpendUsd(
              { inputTokens: totalPromptTokens, outputTokens: totalOutputTokens },
              PRICES,
            ).toFixed(4),
          ),
  }
}

export type SpikeMode = 'check-config' | 'dry-run' | 'live'

// Only the two known flags are accepted. A typo must never fall through into a paid run.
export function parseMode(args: readonly string[]): SpikeMode | null {
  if (args.length === 0) return 'live'
  const [only] = args
  if (args.length === 1 && only === '--check-config') return 'check-config'
  if (args.length === 1 && only === '--dry-run') return 'dry-run'
  return null
}

export function configLine(env: Env): string {
  return `aiConfigured: ${env.geminiApiKey === null ? 'false' : 'true'}`
}

// Why a live run must not start, or null when it may. Never includes a value from the environment.
export function liveRefusal(env: Env): string | null {
  if (env.geminiBaseUrl !== null) {
    return 'refused: GEMINI_BASE_URL is set, and the live spike only talks to Google'
  }
  if (env.geminiApiKey === null) {
    return 'refused: no AI key is configured (add GEMINI_API_KEY to server/.env)'
  }
  return null
}

function readResume(): string {
  return readFileSync(RESUME_PATH, 'utf8')
}

function loadEnvOrNull(): Env | null {
  try {
    return loadServerEnv()
  } catch {
    // The parser error could echo a value, so it is not printed.
    return null
  }
}

function progress(line: string): void {
  console.error(line)
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2))
  if (mode === null) {
    console.error(
      'refused: unknown option (use --check-config or --dry-run, or none for a live run)',
    )
    process.exitCode = 2
    return
  }

  if (mode === 'dry-run') {
    const { startFakeGemini } = await import('../test-support/fake-gemini')
    const fake = await startFakeGemini()
    try {
      const ai = createGeminiClient({ apiKey: 'dry-run-key', baseUrl: fake.url })
      const summary = await runSpike({ ai, resumeText: readResume(), mode, log: progress })
      console.log(JSON.stringify(summary, null, 2))
      console.log('dry-run complete')
    } finally {
      await fake.close()
    }
    return
  }

  const env = loadEnvOrNull()
  if (env === null) {
    console.error('refused: the server environment could not be read')
    process.exitCode = 2
    return
  }

  if (mode === 'check-config') {
    console.log(configLine(env))
    return
  }

  const refusal = liveRefusal(env)
  if (refusal !== null || env.geminiApiKey === null) {
    console.error(refusal ?? 'refused: no AI key is configured')
    process.exitCode = 2
    return
  }

  const ai = createGeminiClient({ apiKey: env.geminiApiKey })
  const summary = await runSpike({ ai, resumeText: readResume(), mode, log: progress })
  console.log(JSON.stringify(summary, null, 2))
  console.log('live run complete')
}

// Program entry: `npm --prefix server run spike:live`.
const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  await main()
}
