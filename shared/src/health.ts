import { z } from 'zod'

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  aiConfigured: z.boolean(),
})
export type HealthResponse = z.infer<typeof healthResponseSchema>
