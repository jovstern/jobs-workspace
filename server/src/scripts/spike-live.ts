// The live-call spike (plan 01-09). It measures the fit call against Google's real model through
// analyzeFit, the same code path the route uses, and prints numbers only.
//
//   npm --prefix server run spike:live -- --check-config   prints whether a key is configured
//   npm --prefix server run spike:live -- --dry-run        rehearses against the stand-in, no key
//   npm --prefix server run spike:live -- --live            LIVE: paid calls, run it by hand, once
//   npm --prefix server run spike:live -- --smoke           LIVE: 1 paid request (plan 01.1-07)
//   npm --prefix server run spike:live -- --advice          LIVE: 8 paid requests (plan 01.1-07)
//   npm --prefix server run spike:live -- --dry-run-smoke   rehearses --smoke against the stand-in
//   npm --prefix server run spike:live -- --dry-run-advice  rehearses --advice against the stand-in
//
// With no option it prints this usage and exits without sending anything: a paid run needs an
// explicit --live, --smoke or --advice flag.
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
import type { AdviceStats } from '../fit/advice'
import { getJob } from '../jobs/seed'
import {
  chooseThinkingLevel,
  countRatingFlips,
  estimateSpendUsd,
  LATENCY_TARGET_MS,
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
function failureText(row: Pick<CallRow, 'errorCode' | 'failure'>): string {
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

// The advice checks (plan 01.1-07): a one-call smoke test and a short measurement.
export const SMOKE_REQUEST_CAP = 1
export const ADVICE_REQUEST_CAP = 10
export const ADVICE_RUNS_PER_PAIR = 4

export type AdviceCheckPlan = 'smoke' | 'advice'

export interface AdviceCheckRow {
  pair: PairName
  ok: boolean
  errorCode: string | null
  failure: AiFailureDiagnostic | null
  wallMs: number
  usage: AiUsage | null
  gaps: number | null
  quoteRejected: number | null
  advice: AdviceStats | null
}

export interface AdviceCheckSummary {
  mode: 'dry-run' | 'live'
  plan: AdviceCheckPlan
  model: string
  requestCap: number
  requestsSent: number
  stoppedEarly: boolean
  rows: AdviceCheckRow[]
  schemaAccepted: boolean | null
  p50LatencyMs: number | null
  p90LatencyMs: number | null
  maxThoughtPlusOutputTokens: number | null
  meanThoughtTokens: number | null
  gapsWithoutPlan: number
  tailoringUnusable: number
  recommendedMaxOutputTokens: number | null
  recommendedDeadlineMs: number | null
  splitRecommended: boolean | null
  estimatedSpendUsd: number | null
}

export interface AdviceCheckOptions {
  ai: AiClient
  resumeText: string
  mode: 'dry-run' | 'live'
  plan: AdviceCheckPlan
  log?: (line: string) => void
}

export interface AdviceCheckFacts {
  mode: 'dry-run' | 'live'
  plan: AdviceCheckPlan
  requestCap: number
  stoppedEarly: boolean
  rows: readonly AdviceCheckRow[]
}

// Whether Google accepted the new answer schema. True as soon as one call came back, false only
// when every call was refused as an invalid request (HTTP 400, INVALID_ARGUMENT), null for any
// other outcome: a key, quota or network failure says nothing about the schema.
export function schemaVerdict(rows: readonly AdviceCheckRow[]): boolean | null {
  if (rows.some((row) => row.ok)) return true
  const allRefused =
    rows.length > 0 &&
    rows.every(
      (row) => row.failure?.httpStatus === 400 && row.failure.category === 'INVALID_ARGUMENT',
    )
  return allRefused ? false : null
}

// What the measurement allows the model settings to become. Measured values may raise the
// defaults and never lower them: the cap never goes below 8192, and the deadline stays between
// 45000 and 55000 ms so the server answers before the browser's 60 second timeout.
const FIT_FLOOR_OUTPUT_TOKENS = 8192
const FIT_FLOOR_DEADLINE_MS = 45000
const FIT_CEILING_DEADLINE_MS = 55000

export function recommendSettings(
  maxThoughtPlusOutput: number,
  p90LatencyMs: number,
): { maxOutputTokens: number; deadlineMs: number } {
  return {
    maxOutputTokens: Math.max(
      FIT_FLOOR_OUTPUT_TOKENS,
      recommendMaxOutputTokens(maxThoughtPlusOutput),
    ),
    deadlineMs: Math.min(
      FIT_CEILING_DEADLINE_MS,
      Math.max(FIT_FLOOR_DEADLINE_MS, recommendDeadlineMs(p90LatencyMs)),
    ),
  }
}

// The numbers a person reads after a check. Pure: built from the rows alone. Latency is taken over
// successful calls only, because a failed call's time says nothing about the answer's size.
export function summariseAdviceCheck(facts: AdviceCheckFacts): AdviceCheckSummary {
  const { mode, plan, requestCap, stoppedEarly, rows } = facts
  const succeeded = rows.filter((row) => row.ok)
  const latencies = succeeded.map((row) => row.wallMs)
  const usages = rows.flatMap((row) => (row.usage === null ? [] : [row.usage]))
  const p50LatencyMs = percentileOrNull(latencies, 50)
  const p90LatencyMs = percentileOrNull(latencies, 90)
  const maxThoughtPlusOutputTokens =
    usages.length === 0 ? null : Math.max(...usages.map(thoughtPlusOutput))
  const settings =
    succeeded.length === 0 || p90LatencyMs === null || maxThoughtPlusOutputTokens === null
      ? null
      : recommendSettings(maxThoughtPlusOutputTokens, p90LatencyMs)
  const totalPromptTokens = usages.reduce((sum, usage) => sum + usage.promptTokens, 0)
  const totalOutputTokens = usages.reduce((sum, usage) => sum + thoughtPlusOutput(usage), 0)

  return {
    mode,
    plan,
    model: MODELS.fit.id,
    requestCap,
    requestsSent: rows.length,
    stoppedEarly,
    rows: [...rows],
    schemaAccepted: schemaVerdict(rows),
    p50LatencyMs,
    p90LatencyMs,
    maxThoughtPlusOutputTokens,
    meanThoughtTokens: mean(usages.map((usage) => usage.thoughtTokens)),
    gapsWithoutPlan: succeeded.reduce(
      (sum, row) => sum + Math.max(0, (row.gaps ?? 0) - (row.advice?.plansKept ?? 0)),
      0,
    ),
    tailoringUnusable: succeeded.filter((row) => row.advice !== null && !row.advice.tailoringUsable)
      .length,
    recommendedMaxOutputTokens: settings?.maxOutputTokens ?? null,
    recommendedDeadlineMs: settings?.deadlineMs ?? null,
    splitRecommended:
      plan === 'smoke' || p90LatencyMs === null ? null : p90LatencyMs > LATENCY_TARGET_MS,
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

// The pairs one plan sends, in order. The smoke call is the poor match: it asks for the most plans,
// so it exercises the new schema hardest.
function scheduleFor(plan: AdviceCheckPlan): PairName[] {
  if (plan === 'smoke') return ['poor']
  return Array.from({ length: ADVICE_RUNS_PER_PAIR }, () => PAIRS.map((pair) => pair.name)).flat()
}

// One live or rehearsed check through analyzeFit, the path the route uses. The smoke plan passes no
// overrides, so it runs at the settings that ship; the advice plan measures what the model uses
// under the spike's own limits. Every request goes through callOnce, so the cap, the stop after
// three failures in a row and the no-retry rule hold in one place.
export async function runAdviceCheck(options: AdviceCheckOptions): Promise<AdviceCheckSummary> {
  const { ai, resumeText, mode, plan } = options
  const log = options.log ?? (() => undefined)
  const requestCap = plan === 'smoke' ? SMOKE_REQUEST_CAP : ADVICE_REQUEST_CAP
  const overrides =
    plan === 'smoke'
      ? undefined
      : {
          thinking: 'LOW' as const,
          maxOutputTokens: SPIKE_MAX_OUTPUT_TOKENS,
          deadlineMs: SPIKE_DEADLINE_MS,
        }
  const rows: AdviceCheckRow[] = []
  let consecutiveFailures = 0
  let stoppedEarly = false

  async function callOnce(pairName: PairName): Promise<void> {
    if (stoppedEarly) return
    if (rows.length >= requestCap || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      stoppedEarly = true
      return
    }
    const job = getJob(pairOf(pairName).jobId)
    if (job === undefined) throw new Error('seed job missing')
    let usage: AiUsage | null = null
    let failure: AiFailureDiagnostic | null = null
    let advice: AdviceStats | null = null
    const startedAt = performance.now()
    let row: AdviceCheckRow
    try {
      const response = await analyzeFit({
        ai,
        job,
        resumeText,
        signal: new AbortController().signal,
        now: () => Date.now(),
        overrides,
        onUsage: (reported) => {
          usage = reported
        },
        onFailure: (reported) => {
          failure = reported
        },
        onAdviceStats: (reported) => {
          advice = reported
        },
      })
      row = {
        pair: pairName,
        ok: true,
        errorCode: null,
        failure: null,
        wallMs: Math.round(performance.now() - startedAt),
        usage,
        gaps: response.ratings.filter((rated) => rated.rating !== 'met').length,
        quoteRejected: response.ratings.filter((rated) => rated.quoteRejected).length,
        advice,
      }
      consecutiveFailures = 0
    } catch (error) {
      row = {
        pair: pairName,
        ok: false,
        errorCode: error instanceof AppError ? error.code : 'unexpected_error',
        failure,
        wallMs: Math.round(performance.now() - startedAt),
        usage,
        gaps: null,
        quoteRejected: null,
        advice: null,
      }
      consecutiveFailures += 1
    }
    rows.push(row)
    log(
      `[${String(rows.length)}/${String(requestCap)}] ${plan} ${pairName} ${
        row.ok ? 'ok' : failureText(row)
      } ${String(row.wallMs)}ms`,
    )
  }

  for (const pairName of scheduleFor(plan)) await callOnce(pairName)

  return summariseAdviceCheck({ mode, plan, requestCap, stoppedEarly, rows })
}

export type SpikeMode =
  'check-config' | 'dry-run' | 'live' | 'smoke' | 'advice' | 'dry-run-smoke' | 'dry-run-advice'

export const USAGE = [
  'usage: npm --prefix server run spike:live -- <option>',
  '  --live          paid calls to Google, run it by hand, once',
  '  --dry-run       rehearse against the stand-in, no key, nothing sent',
  '  --check-config  print whether a key is configured',
  '  --smoke         LIVE: 1 paid request, checks that Google accepts the answer schema',
  '  --advice        LIVE: 8 paid requests, measures the size and time of the larger answer',
  '  --dry-run-smoke   rehearse --smoke against the stand-in, no key, nothing sent',
  '  --dry-run-advice  rehearse --advice against the stand-in, no key, nothing sent',
].join('\n')

// Only the known flags are accepted, one at a time. No flag and a typo both return null, so
// neither can fall through into a paid run: a live run is always an explicit --live, --smoke or
// --advice.
export function parseMode(args: readonly string[]): SpikeMode | null {
  const [only] = args
  if (args.length === 1 && only === '--live') return 'live'
  if (args.length === 1 && only === '--check-config') return 'check-config'
  if (args.length === 1 && only === '--dry-run') return 'dry-run'
  if (args.length === 1 && only === '--smoke') return 'smoke'
  if (args.length === 1 && only === '--advice') return 'advice'
  if (args.length === 1 && only === '--dry-run-smoke') return 'dry-run-smoke'
  if (args.length === 1 && only === '--dry-run-advice') return 'dry-run-advice'
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
    console.error(USAGE)
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

  if (mode === 'dry-run-smoke' || mode === 'dry-run-advice') {
    const { startFakeGemini } = await import('../test-support/fake-gemini')
    const fake = await startFakeGemini()
    try {
      const ai = createGeminiClient({ apiKey: 'dry-run-key', baseUrl: fake.url })
      const summary = await runAdviceCheck({
        ai,
        resumeText: readResume(),
        mode: 'dry-run',
        plan: mode === 'dry-run-smoke' ? 'smoke' : 'advice',
        log: progress,
      })
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
  if (mode === 'smoke' || mode === 'advice') {
    const summary = await runAdviceCheck({
      ai,
      resumeText: readResume(),
      mode: 'live',
      plan: mode,
      log: progress,
    })
    console.log(JSON.stringify(summary, null, 2))
    console.log(mode === 'smoke' ? 'smoke complete' : 'advice measurement complete')
    return
  }

  const summary = await runSpike({ ai, resumeText: readResume(), mode, log: progress })
  console.log(JSON.stringify(summary, null, 2))
  console.log('live run complete')
}

// Program entry: `npm --prefix server run spike:live`.
const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  await main()
}
