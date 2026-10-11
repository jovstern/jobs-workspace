// The only place a model id may appear (D-04). Everything else asks for a task by name.
//
// Plan 01-09 tunes the thinking level and the output cap from live measurements. Note that
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
    maxOutputTokens: 8192,
    deadlineMs: 45000,
  },
} satisfies Record<string, ModelConfig>

export type AiTask = keyof typeof MODELS
