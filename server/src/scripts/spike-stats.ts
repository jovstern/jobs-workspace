// Pure helpers for the live-call spike (plan 01-09). Nothing here touches the network or the
// environment, so the rules that choose the model settings are unit tested.
import type { Rating } from '@jobs-workspace/shared'

import type { ThinkingLevelName } from '../config/models'

export const THINKING_LEVEL_ORDER: readonly ThinkingLevelName[] = ['LOW', 'MEDIUM', 'HIGH']

// The rule for choosing a level (plan 01-09, "Claude's Discretion"): fast enough, and stable.
export const LATENCY_TARGET_MS = 15000
export const NEAR_PERFECT_REQUIRED_MET = 6
export const POOR_MAX_REQUIRED_MET = 2
export const MAX_AVERAGE_FLIPS_PER_PAIR = 1

const OUTPUT_CAP_MIN = 4096
const OUTPUT_CAP_MAX = 16384
const OUTPUT_CAP_STEP = 1024
const DEADLINE_MIN_MS = 30000
const DEADLINE_MAX_MS = 60000
const DEADLINE_STEP_MS = 5000
const DEADLINE_FACTOR = 3

export interface LevelMeasurement {
  level: ThinkingLevelName
  p90LatencyMs: number
  // Calls that threw. Any failure means the level is not trusted.
  failures: number
  // Per successful run: how many required requirements were rated met.
  nearRequiredMet: number[]
  poorRequiredMet: number[]
  // Rating flips per pair, averaged over the two pairs.
  averageFlipsPerPair: number
}

export interface Prices {
  // US dollars per million tokens.
  input: number
  output: number
}

// Nearest-rank percentile: the smallest value with at least p percent of the values at or below it.
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) throw new RangeError('percentile of an empty list')
  if (!(p > 0 && p <= 100)) throw new RangeError('percentile must be in (0, 100]')
  const sorted = values.toSorted((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  const value = sorted[rank - 1]
  if (value === undefined) throw new RangeError('percentile rank out of range')
  return value
}

// How many requirement positions got a different rating in at least one run.
export function countRatingFlips(runs: readonly (readonly Rating[])[]): number {
  const [first, ...rest] = runs
  if (first === undefined) return 0
  if (rest.some((run) => run.length !== first.length)) {
    throw new RangeError('runs rate a different number of requirements')
  }
  return first.filter((rating, position) => rest.some((run) => run[position] !== rating)).length
}

function isFastEnough(measurement: LevelMeasurement, targetMs: number): boolean {
  return measurement.p90LatencyMs <= targetMs
}

function isStable(measurement: LevelMeasurement, requiredCount: number): boolean {
  const { failures, nearRequiredMet, poorRequiredMet, averageFlipsPerPair } = measurement
  if (failures > 0) return false
  if (nearRequiredMet.length === 0 || poorRequiredMet.length === 0) return false
  return (
    nearRequiredMet.every((met) => met === requiredCount) &&
    poorRequiredMet.every((met) => met <= POOR_MAX_REQUIRED_MET) &&
    averageFlipsPerPair <= MAX_AVERAGE_FLIPS_PER_PAIR
  )
}

// The lowest of LOW, MEDIUM, HIGH that meets the latency target and the stability rule, or null.
export function chooseThinkingLevel(
  measurements: readonly LevelMeasurement[],
  options: { targetMs?: number; requiredCount?: number } = {},
): ThinkingLevelName | null {
  const targetMs = options.targetMs ?? LATENCY_TARGET_MS
  const requiredCount = options.requiredCount ?? NEAR_PERFECT_REQUIRED_MET
  for (const level of THINKING_LEVEL_ORDER) {
    const measurement = measurements.find((candidate) => candidate.level === level)
    if (
      measurement !== undefined &&
      isFastEnough(measurement, targetMs) &&
      isStable(measurement, requiredCount)
    ) {
      return level
    }
  }
  return null
}

// `maxObserved` is the largest thought plus output token count seen. Twice that, rounded up to a
// multiple of 1024, kept between 4096 and 16384.
export function recommendMaxOutputTokens(maxObserved: number): number {
  const rounded = Math.ceil((2 * maxObserved) / OUTPUT_CAP_STEP) * OUTPUT_CAP_STEP
  return Math.min(OUTPUT_CAP_MAX, Math.max(OUTPUT_CAP_MIN, rounded))
}

// Three times the p90 latency, rounded up to 5000 ms, kept between 30000 and 60000.
export function recommendDeadlineMs(p90LatencyMs: number): number {
  const rounded = Math.ceil((DEADLINE_FACTOR * p90LatencyMs) / DEADLINE_STEP_MS) * DEADLINE_STEP_MS
  return Math.min(DEADLINE_MAX_MS, Math.max(DEADLINE_MIN_MS, rounded))
}

// Output tokens here must already include thinking tokens, which are billed as output.
export function estimateSpendUsd(
  tokens: { inputTokens: number; outputTokens: number },
  prices: Prices,
): number {
  return (tokens.inputTokens * prices.input + tokens.outputTokens * prices.output) / 1_000_000
}
