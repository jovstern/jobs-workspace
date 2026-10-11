// The only place a model id may appear (D-04). Everything else asks for a task by name.
//
// Plan 01-09 chose the thinking level, the output cap and the deadline below from live
// measurements: see .planning/phases/01-real-ai-path-end-to-end/01-SPIKE-RESULTS.md. Note that
// `minimal` thinking is an error on this model, so the lowest level here is LOW.
// `maxOutputTokens` counts thinking tokens too.
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
    maxOutputTokens: 4096,
    deadlineMs: 30000,
  },
} satisfies Record<string, ModelConfig>

export type AiTask = keyof typeof MODELS
