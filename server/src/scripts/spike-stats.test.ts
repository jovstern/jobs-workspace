import { describe, expect, test } from 'vitest'

import {
  chooseThinkingLevel,
  countRatingFlips,
  estimateSpendUsd,
  percentile,
  recommendDeadlineMs,
  recommendMaxOutputTokens,
} from './spike-stats'
import type { LevelMeasurement } from './spike-stats'

describe('percentile', () => {
  test('uses the nearest rank', () => {
    const values = [100, 200, 300, 400, 500]
    expect(percentile(values, 90)).toBe(500)
    expect(percentile(values, 50)).toBe(300)
    expect(percentile(values, 100)).toBe(500)
  })

  test('does not depend on the order of the input', () => {
    expect(percentile([500, 100, 400, 200, 300], 50)).toBe(300)
  })

  test('throws on an empty list', () => {
    expect(() => percentile([], 90)).toThrow()
  })
})

describe('countRatingFlips', () => {
  test('is 0 for identical runs', () => {
    const run = ['met', 'partial', 'not_evidenced'] as const
    expect(countRatingFlips([run, run, run])).toBe(0)
  })

  test('is 0 for a single run', () => {
    expect(countRatingFlips([['met', 'met']])).toBe(0)
  })

  test('counts a position once however many runs disagree', () => {
    expect(
      countRatingFlips([
        ['met', 'partial', 'met'],
        ['met', 'met', 'met'],
        ['met', 'not_evidenced', 'met'],
      ]),
    ).toBe(1)
  })

  test('counts each position that differs in any run', () => {
    expect(
      countRatingFlips([
        ['met', 'partial', 'met'],
        ['partial', 'partial', 'not_evidenced'],
      ]),
    ).toBe(2)
  })

  test('throws when the runs rate a different number of requirements', () => {
    expect(() => countRatingFlips([['met'], ['met', 'met']])).toThrow()
  })
})

function steady(level: LevelMeasurement['level'], overrides: Partial<LevelMeasurement> = {}) {
  return {
    level,
    p90LatencyMs: 9000,
    failures: 0,
    nearRequiredMet: [6, 6, 6],
    poorRequiredMet: [1, 2, 1],
    averageFlipsPerPair: 0.5,
    ...overrides,
  } satisfies LevelMeasurement
}

describe('chooseThinkingLevel', () => {
  test('returns the lowest level that is fast enough and stable', () => {
    expect(chooseThinkingLevel([steady('LOW'), steady('MEDIUM'), steady('HIGH')])).toBe('LOW')
  })

  test('skips a level whose p90 latency is over the target', () => {
    expect(
      chooseThinkingLevel([
        steady('LOW', { p90LatencyMs: 15001 }),
        steady('MEDIUM'),
        steady('HIGH'),
      ]),
    ).toBe('MEDIUM')
  })

  test('accepts a p90 latency exactly at the target', () => {
    expect(chooseThinkingLevel([steady('LOW', { p90LatencyMs: 15000 })])).toBe('LOW')
  })

  test('skips a level where the near-perfect pair misses a required requirement in any run', () => {
    expect(
      chooseThinkingLevel([steady('LOW', { nearRequiredMet: [6, 5, 6] }), steady('MEDIUM')]),
    ).toBe('MEDIUM')
  })

  test('skips a level where the poor pair meets more than two required requirements in any run', () => {
    expect(
      chooseThinkingLevel([steady('LOW', { poorRequiredMet: [1, 3, 1] }), steady('MEDIUM')]),
    ).toBe('MEDIUM')
  })

  test('skips a level that flips more than one rating per pair on average', () => {
    expect(
      chooseThinkingLevel([steady('LOW', { averageFlipsPerPair: 1.5 }), steady('MEDIUM')]),
    ).toBe('MEDIUM')
  })

  test('accepts an average of exactly one flip per pair', () => {
    expect(chooseThinkingLevel([steady('LOW', { averageFlipsPerPair: 1 })])).toBe('LOW')
  })

  test('skips a level with a failed call', () => {
    expect(chooseThinkingLevel([steady('LOW', { failures: 1 }), steady('HIGH')])).toBe('HIGH')
  })

  test('skips a level with no successful runs', () => {
    expect(
      chooseThinkingLevel([
        steady('LOW', { nearRequiredMet: [], poorRequiredMet: [] }),
        steady('MEDIUM'),
      ]),
    ).toBe('MEDIUM')
  })

  test('picks by level order, not by the order of the list', () => {
    expect(chooseThinkingLevel([steady('HIGH'), steady('MEDIUM'), steady('LOW')])).toBe('LOW')
  })

  test('returns null when no level meets both the latency target and the stability rule', () => {
    expect(
      chooseThinkingLevel([
        steady('LOW', { p90LatencyMs: 20000 }),
        steady('MEDIUM', { nearRequiredMet: [4, 6, 6] }),
        steady('HIGH', { averageFlipsPerPair: 2 }),
      ]),
    ).toBeNull()
  })

  test('returns null for no measurements', () => {
    expect(chooseThinkingLevel([])).toBeNull()
  })
})

describe('recommendMaxOutputTokens', () => {
  test('is twice the maximum observed, rounded up to a multiple of 1024', () => {
    expect(recommendMaxOutputTokens(3000)).toBe(6144)
    expect(recommendMaxOutputTokens(5000)).toBe(10240)
  })

  test('is at least 4096', () => {
    expect(recommendMaxOutputTokens(1500)).toBe(4096)
    expect(recommendMaxOutputTokens(0)).toBe(4096)
  })

  test('never exceeds 16384', () => {
    expect(recommendMaxOutputTokens(9000)).toBe(16384)
    expect(recommendMaxOutputTokens(60000)).toBe(16384)
  })
})

describe('recommendDeadlineMs', () => {
  test('is three times the p90, rounded up to 5000 ms', () => {
    expect(recommendDeadlineMs(12000)).toBe(40000)
    expect(recommendDeadlineMs(12100)).toBe(40000)
  })

  test('is at least 30000', () => {
    expect(recommendDeadlineMs(4000)).toBe(30000)
  })

  test('is at most 60000', () => {
    expect(recommendDeadlineMs(30000)).toBe(60000)
  })
})

describe('estimateSpendUsd', () => {
  test('prices input and output tokens per million', () => {
    expect(
      estimateSpendUsd(
        { inputTokens: 1_000_000, outputTokens: 1_000_000 },
        { input: 0.75, output: 3.75 },
      ),
    ).toBeCloseTo(4.5)
  })
})
