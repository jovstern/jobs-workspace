import { FinishReason, GoogleGenAI, ThinkingLevel } from '@google/genai'
import { z } from 'zod'

import { MODELS } from '../config/models'
import type { AiTask, ThinkingLevelName } from '../config/models'
import { AppError } from '../http/errors'
import { diagnoseError } from './diagnose'
import type { AiFailureDiagnostic, FailureCategory } from './diagnose'
import { failureToErrorCode } from './failure-code'
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
  // What the answer is parsed with.
  schema: z.ZodType<T>
  // What the provider is shown. Defaults to `schema`; set it when the parse schema is more lenient
  // than the one the provider should be asked to follow.
  wireSchema?: z.ZodType
  signal: AbortSignal
  overrides?: {
    thinking?: ThinkingLevelName
    maxOutputTokens?: number
    deadlineMs?: number
  }
  onUsage?: (usage: AiUsage) => void
  // Told, once, why a call failed: a status number and a category, never any text.
  onFailure?: (diagnostic: AiFailureDiagnostic) => void
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

    // Reports why a call failed, as a status and a category only, and ends it with the one typed
    // error whose code names the cause. Nothing about the failure itself is kept.
    function fail(diagnostic: AiFailureDiagnostic): never {
      request.onFailure?.(diagnostic)
      throw new AppError(failureToErrorCode(diagnostic))
    }

    function reject(category: FailureCategory): never {
      fail({ httpStatus: null, category, errorClass: null })
    }

    try {
      // generateContent only, with no optional extras: nothing is stored at the provider, no
      // tool can run, and a failed call is never retried behind the user's back.
      const response = await genai.models.generateContent({
        model: model.id,
        contents: [{ role: 'user', parts: [{ text: request.userText }] }],
        config: {
          systemInstruction: request.system,
          responseMimeType: 'application/json',
          responseJsonSchema: toGeminiSchema(request.wireSchema ?? request.schema),
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
      if (response.promptFeedback?.blockReason !== undefined) reject('blocked')
      if (finishReason !== FinishReason.STOP) reject('unfinished')
      const text = response.text
      if (text === undefined || text.trim() === '') reject('empty_text')

      const parsed = request.schema.safeParse(JSON.parse(text))
      if (!parsed.success) reject('schema_mismatch')
      return parsed.data
    } catch (error) {
      // ApiError, aborts (client gone or deadline), network failures and unparseable JSON all
      // end here. Nothing about the failure is kept: it could echo prompt or model text.
      if (error instanceof AppError) throw error
      fail(diagnoseError(error))
    }
  }

  return { generateJson }
}
