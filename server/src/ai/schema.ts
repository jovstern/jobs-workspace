import { z } from 'zod'

// RED-phase stand-in: converts without the supported-keyword shaping. Replaced in the next commit.
export function toGeminiSchema(schema: z.ZodType): unknown {
  return z.toJSONSchema(schema, { target: 'draft-7' })
}
