import { ratingSchema } from '@jobs-workspace/shared'
import type { Job } from '@jobs-workspace/shared'
import { z } from 'zod'

import { AppError } from '../../http/errors'

export const FIT_PROMPT_VERSION = 'fit-ratings-1'

export const FIT_SYSTEM_INSTRUCTION = [
  'TASK: fit-ratings',
  'You rate how well a resume evidences each requirement of one job posting.',
].join('\n')

export function fitModelOutputSchema(ids: readonly string[]) {
  const [first, ...rest] = ids
  if (first === undefined) throw new AppError('internal_error')
  return z.object({
    ratings: z
      .array(
        z.object({
          requirementId: z.enum([first, ...rest]),
          quote: z.string().min(12).nullable(),
          rating: ratingSchema,
          rationale: z.string().max(400),
        }),
      )
      .min(ids.length)
      .max(ids.length),
  })
}

export function buildFitUserTurn(job: Job, preparedResume: string): string {
  return [
    `<job id="${job.id}">`,
    `Title: ${job.title}`,
    ...job.requirements.map(
      (requirement) => `- [${requirement.id}] (${requirement.kind}) ${requirement.text}`,
    ),
    '</job>',
    '',
    '<resume>',
    preparedResume,
    '</resume>',
    '',
    'Rate every requirement listed in <job> against the text in <resume>.',
  ].join('\n')
}
