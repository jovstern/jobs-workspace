// The only place a model id may appear (D-04). Everything else asks for a task by name.
//
// Plan 01-09 chose the thinking level, the output cap and the deadline below from live
// measurements: see .planning/phases/01-real-ai-path-end-to-end/01-SPIKE-RESULTS.md. Note that
// `minimal` thinking is an error on this model, so the lowest level here is LOW.
// `maxOutputTokens` counts thinking tokens too.
//
// Phase 01.1 asks for a learning plan per gap and tailoring tips on top of the ratings, so the
// answer is larger. The numbers below are estimates, not measurements: a worst-case answer is about
// 3,200 output tokens (eight ratings, eight plans, five tips, eight keywords), so 8192 leaves room
// for the thinking tokens that share the cap. The deadline is three times an estimated p90 of 12 to
// 16 seconds. It must stay under the browser's 60 second DEFAULT_TIMEOUT_MS (src/lib/api.ts), so
// the server always answers first with its own error. If plan 01.1-07 measures the real call, its
// figures are in 01.1-SPIKE-RESULTS.md in the phase directory and replace these estimates.
export type ThinkingLevelName = 'LOW' | 'MEDIUM' | 'HIGH'

export interface ModelConfig {
  id: string
  thinking: ThinkingLevelName
  maxOutputTokens: number
  deadlineMs: number
}

export const MODELS = {
  fit: {
    id: 'gemini-3.8-flash',
    thinking: 'LOW',
    maxOutputTokens: 8192,
    deadlineMs: 45000,
  },
} satisfies Record<string, ModelConfig>

export type AiTask = keyof typeof MODELS
