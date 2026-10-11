import { FinishReason, GoogleGenAI, ThinkingLevel } from '@google/genai'
import { z } from 'zod'

import { MODELS } from '../config/models'
import type { AiTask, ThinkingLevelName } from '../config/models'
import { AppError } from '../http/errors'
import { toGeminiSchema } from './schema'

export interface AiUsage {
  promptTokens: number
  outputTokens: number
  thoughtTokens: number
  totalTokens: number
  finishReason: string
  latencyMs: number
}

export interface GenerateJsonRequest<T> {
  task: AiTask
  system: string
  userText: string
  schema: z.ZodType<T>
  signal: AbortSignal
  overrides?: {
    thinking?: ThinkingLevelName
    maxOutputTokens?: number
    deadlineMs?: number
  }
  onUsage?: (usage: AiUsage) => void
}

// The seam between the app and the provider. Everything above it knows tasks and schemas, not
// model ids or the SDK.
export interface AiClient {
  generateJson: <T>(request: GenerateJsonRequest<T>) => Promise<T>
}

export interface GeminiClientOptions {
  apiKey: string
  // Test-only: points the real SDK at the stand-in model. Undefined in production.
  baseUrl?: string
}

const THINKING_LEVELS: Record<ThinkingLevelName, ThinkingLevel> = {
  LOW: ThinkingLevel.LOW,
  MEDIUM: ThinkingLevel.MEDIUM,
  HIGH: ThinkingLevel.HIGH,
}

export function createGeminiClient(options: GeminiClientOptions): AiClient {
  const genai = new GoogleGenAI({
    apiKey: options.apiKey,
    httpOptions: options.baseUrl === undefined ? undefined : { baseUrl: options.baseUrl },
  })

  async function generateJson<T>(request: GenerateJsonRequest<T>): Promise<T> {
    const model = MODELS[request.task]
    const deadlineMs = request.overrides?.deadlineMs ?? model.deadlineMs
    const startedAt = Date.now()

    try {
      // generateContent only, with no optional extras: nothing is stored at the provider, no
      // tool can run, and a failed call is never retried behind the user's back.
      const response = await genai.models.generateContent({
        model: model.id,
        contents: [{ role: 'user', parts: [{ text: request.userText }] }],
        config: {
          systemInstruction: request.system,
          responseMimeType: 'application/json',
          responseJsonSchema: toGeminiSchema(request.schema),
          thinkingConfig: {
            thinkingLevel: THINKING_LEVELS[request.overrides?.thinking ?? model.thinking],
          },
          maxOutputTokens: request.overrides?.maxOutputTokens ?? model.maxOutputTokens,
          abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(deadlineMs)]),
        },
      })

      const finishReason = response.candidates?.[0]?.finishReason
      if (request.onUsage && response.usageMetadata) {
        const usage = response.usageMetadata
        request.onUsage({
          promptTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
          thoughtTokens: usage.thoughtsTokenCount ?? 0,
          totalTokens: usage.totalTokenCount ?? 0,
          finishReason: finishReason ?? 'NONE',
          latencyMs: Date.now() - startedAt,
        })
      }

      // A blocked, truncated or empty answer arrives as HTTP 200, so success is never assumed.
      if (response.promptFeedback?.blockReason !== undefined) throw new AppError('ai_failed')
      if (finishReason !== FinishReason.STOP) throw new AppError('ai_failed')
      const text = response.text
      if (text === undefined || text.trim() === '') throw new AppError('ai_failed')

      const parsed = request.schema.safeParse(JSON.parse(text))
      if (!parsed.success) throw new AppError('ai_failed')
      return parsed.data
    } catch (error) {
      // ApiError, aborts (client gone or deadline), network failures and unparseable JSON all
      // end here. Nothing about the failure is kept: it could echo prompt or model text.
      if (error instanceof AppError) throw error
      throw new AppError('ai_failed')
    }
  }

  return { generateJson }
}
