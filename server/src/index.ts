import { createGeminiClient } from './ai/client'
import { createApp } from './app'
import { loadServerEnv } from './config/env'

const env = loadServerEnv()

// Without a key the server still starts; AI routes then answer 503 ai_not_configured.
const ai =
  env.geminiApiKey === null
    ? null
    : createGeminiClient({
        apiKey: env.geminiApiKey,
        baseUrl: env.geminiBaseUrl ?? undefined,
      })

// Loopback only: this server proxies AI calls and must not be reachable from the network.
createApp({
  ai,
  env,
  rateLimit: { windowMs: 60_000, max: 20 },
  log: (line) => {
    console.log(line)
  },
}).listen(env.port, '127.0.0.1', () => {
  console.log(
    `server listening on http://127.0.0.1:${String(env.port)} (AI configured: ${ai === null ? 'no' : 'yes'})`,
  )
})
