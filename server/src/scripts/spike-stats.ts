import type { Rating } from '@jobs-workspace/shared'

import type { ThinkingLevelName } from '../config/models'

export interface LevelMeasurement {
  level: ThinkingLevelName
  p90LatencyMs: number
  failures: number
  nearRequiredMet: number[]
  poorRequiredMet: number[]
  averageFlipsPerPair: number
}

export interface Prices {
  input: number
  output: number
}

// Placeholder bodies for the RED commit: every function returns a plausible but wrong value.
export function percentile(values: readonly number[], p: number): number {
  return values[0] ?? p
}

export function countRatingFlips(runs: readonly (readonly Rating[])[]): number {
  return runs.length
}

export function chooseThinkingLevel(
  measurements: readonly LevelMeasurement[],
): ThinkingLevelName | null {
  return measurements[0]?.level ?? null
}

export function recommendMaxOutputTokens(maxObserved: number): number {
  return maxObserved
}

export function recommendDeadlineMs(p90LatencyMs: number): number {
  return p90LatencyMs
}

export function estimateSpendUsd(
  tokens: { inputTokens: number; outputTokens: number },
  prices: Prices,
): number {
  return tokens.inputTokens * prices.input
}
