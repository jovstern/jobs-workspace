import { createHash } from 'node:crypto'

import { jobSchema } from '@jobs-workspace/shared'
import type { Job, Requirement } from '@jobs-workspace/shared'

import { SEED_JOBS } from './seed-jobs'

// First 16 hex characters of the SHA-256 of the JSON array of [id, kind, text] triples in posting
// order. The skill label is deliberately not part of it, so relabelling never invalidates a
// stored analysis.
export function computeContentVersion(requirements: readonly Requirement[]): string {
  const triples = requirements.map((requirement) => [
    requirement.id,
    requirement.kind,
    requirement.text,
  ])
  return createHash('sha256').update(JSON.stringify(triples)).digest('hex').slice(0, 16)
}

// The hand-written jobs live in seed-jobs.ts. Each is given its content version and validated
// with the shared job schema when this module loads, so a bad seed (a job with no requirements,
// an unknown skill label) stops the server from starting instead of being served.
const jobs: Job[] = SEED_JOBS.map((job) =>
  jobSchema.parse({ ...job, contentVersion: computeContentVersion(job.requirements) }),
)

export function listJobs(): Job[] {
  return jobs
}

export function getJob(id: string): Job | undefined {
  return jobs.find((job) => job.id === id)
}
