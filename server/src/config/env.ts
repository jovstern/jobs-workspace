import { fileURLToPath } from 'node:url'

import { z } from 'zod'

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]

// An empty value in the environment means "not set".
const optionalText = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim()
    return trimmed === undefined || trimmed === '' ? null : trimmed
  })

const envSchema = z.object({
  GEMINI_API_KEY: optionalText,
  // Test-only: points the real SDK at the stand-in model. Read from the process environment,
  // never from a request.
  GEMINI_BASE_URL: optionalText,
  PORT: optionalText,
  ALLOWED_ORIGINS: optionalText,
})

const portSchema = z.coerce.number().int().min(1).max(65535)

export interface Env {
  geminiApiKey: string | null
  geminiBaseUrl: string | null
  port: number
  allowedOrigins: string[]
}

// Pure: validates a plain object. Never logs or returns anything but the parsed fields, and the
// key is only ever handed to the SDK client.
export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.parse(source)
  const origins = parsed.ALLOWED_ORIGINS
  return {
    geminiApiKey: parsed.GEMINI_API_KEY,
    geminiBaseUrl: parsed.GEMINI_BASE_URL,
    port: portSchema.parse(parsed.PORT ?? '3001'),
    allowedOrigins:
      origins === null
        ? DEFAULT_ALLOWED_ORIGINS
        : origins
            .split(',')
            .map((origin) => origin.trim())
            .filter((origin) => origin !== ''),
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

// Loads `server/.env` (beside server/package.json) with the Node built-in, then parses the
// process environment. Values already in the process environment win over the file.
export function loadServerEnv(): Env {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)))
  } catch (error) {
    if (!isMissingFile(error)) throw error
  }
  return parseEnv(process.env)
}
