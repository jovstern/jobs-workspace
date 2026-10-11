import { readFileSync } from 'node:fs'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import {
  SKILL_VOCABULARY,
  fitResponseSchema,
  jobSchema,
  jobsResponseSchema,
  redactContactDetails,
} from '@jobs-workspace/shared'
import type { Requirement } from '@jobs-workspace/shared'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createGeminiClient } from '../ai/client'
import { createApp } from '../app'
import { startFakeGemini } from '../test-support/fake-gemini'
import type { FakeGemini } from '../test-support/fake-gemini'
import { computeContentVersion, getJob, listJobs } from './seed'

// Job ids and requirement ids are hand-assigned and must never change: stored analyses and, from
// Phase 3, tracked applications are keyed by them. Every one of them is pinned here as a literal.
const PINNED: Record<string, string[]> = {
  'job-frontend-junior': [
    'fe-jr-r1',
    'fe-jr-r2',
    'fe-jr-r3',
    'fe-jr-r4',
    'fe-jr-r5',
    'fe-jr-r6',
    'fe-jr-r7',
  ],
  'job-frontend-senior': [
    'fe-sr-r1',
    'fe-sr-r2',
    'fe-sr-r3',
    'fe-sr-r4',
    'fe-sr-r5',
    'fe-sr-r6',
    'fe-sr-r7',
    'fe-sr-r8',
  ],
  'job-backend-mid': [
    'be-mid-r1',
    'be-mid-r2',
    'be-mid-r3',
    'be-mid-r4',
    'be-mid-r5',
    'be-mid-r6',
    'be-mid-r7',
    'be-mid-r8',
  ],
  'job-backend-staff': [
    'be-st-r1',
    'be-st-r2',
    'be-st-r3',
    'be-st-r4',
    'be-st-r5',
    'be-st-r6',
    'be-st-r7',
    'be-st-r8',
    'be-st-r9',
  ],
  'job-fullstack-mid': [
    'fs-mid-r1',
    'fs-mid-r2',
    'fs-mid-r3',
    'fs-mid-r4',
    'fs-mid-r5',
    'fs-mid-r6',
    'fs-mid-r7',
    'fs-mid-r8',
  ],
  'job-fullstack-senior': [
    'fs-sr-r1',
    'fs-sr-r2',
    'fs-sr-r3',
    'fs-sr-r4',
    'fs-sr-r5',
    'fs-sr-r6',
    'fs-sr-r7',
    'fs-sr-r8',
    'fs-sr-r9',
  ],
  'job-data-engineer-mid': [
    'de-mid-r1',
    'de-mid-r2',
    'de-mid-r3',
    'de-mid-r4',
    'de-mid-r5',
    'de-mid-r6',
    'de-mid-r7',
    'de-mid-r8',
  ],
  'job-data-scientist-senior': [
    'ds-sr-r1',
    'ds-sr-r2',
    'ds-sr-r3',
    'ds-sr-r4',
    'ds-sr-r5',
    'ds-sr-r6',
    'ds-sr-r7',
    'ds-sr-r8',
  ],
  'job-engineering-manager': [
    'em-r1',
    'em-r2',
    'em-r3',
    'em-r4',
    'em-r5',
    'em-r6',
    'em-r7',
    'em-r8',
  ],
}

const PINNED_ORDER = [
  'job-frontend-junior',
  'job-frontend-senior',
  'job-backend-mid',
  'job-backend-staff',
  'job-fullstack-mid',
  'job-fullstack-senior',
  'job-data-engineer-mid',
  'job-data-scientist-senior',
  'job-engineering-manager',
]

// The content version of job-frontend-senior before this plan touched the seed (recorded from the
// tracer). The job was moved, not edited, so the value must not move.
const FRONTEND_SENIOR_CONTENT_VERSION = '14714af0fe5ddc87'

const RESUME_PATH = new URL('../../../e2e/fixtures/resumes/frontend-senior.txt', import.meta.url)

describe('seed jobs', () => {
  test('serves exactly the nine pinned job ids in the pinned order', () => {
    expect(listJobs().map((job) => job.id)).toEqual(PINNED_ORDER)
  })

  test('requirement ids match the pinned list for every job, in posting order', () => {
    for (const [jobId, requirementIds] of Object.entries(PINNED)) {
      expect(
        getJob(jobId)?.requirements.map((requirement) => requirement.id),
        jobId,
      ).toEqual(requirementIds)
    }
  })

  test('requirement ids are unique across the whole seed', () => {
    const ids = listJobs().flatMap((job) => job.requirements.map((requirement) => requirement.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every job has 6 to 10 requirements, 5 to 7 required and 1 to 4 nice to have', () => {
    for (const job of listJobs()) {
      const required = job.requirements.filter((requirement) => requirement.kind === 'required')
      const nice = job.requirements.filter((requirement) => requirement.kind === 'nice_to_have')
      expect(job.requirements.length, job.id).toBeGreaterThanOrEqual(6)
      expect(job.requirements.length, job.id).toBeLessThanOrEqual(10)
      expect(required.length, job.id).toBeGreaterThanOrEqual(5)
      expect(required.length, job.id).toBeLessThanOrEqual(7)
      expect(nice.length, job.id).toBeGreaterThanOrEqual(1)
      expect(nice.length, job.id).toBeLessThanOrEqual(4)
    }
  })

  test('every requirement skill is in the controlled vocabulary and every job passes the shared schema', () => {
    const vocabulary: readonly string[] = SKILL_VOCABULARY
    for (const job of listJobs()) {
      expect(jobSchema.safeParse(job).success, job.id).toBe(true)
      for (const requirement of job.requirements) {
        expect(vocabulary, requirement.id).toContain(requirement.skill)
      }
    }
  })

  test('covers frontend, backend, full-stack, data and engineering manager from junior to staff', () => {
    const levels = new Set(listJobs().map((job) => job.level))
    for (const level of ['Junior', 'Mid', 'Senior', 'Staff', 'Manager']) {
      expect(levels.has(level as 'Junior'), level).toBe(true)
    }
  })

  test('job-frontend-senior keeps its content version from before this plan', () => {
    expect(getJob('job-frontend-senior')?.contentVersion).toBe(FRONTEND_SENIOR_CONTENT_VERSION)
  })

  test('the content version is stable across calls and changes when a requirement text changes', () => {
    const requirements = getJob('job-frontend-senior')?.requirements ?? []
    expect(requirements.length).toBeGreaterThan(0)
    expect(computeContentVersion(requirements)).toBe(computeContentVersion(requirements))

    const edited: Requirement[] = requirements.map((requirement, index) =>
      index === 0 ? { ...requirement, text: `${requirement.text} Edited.` } : requirement,
    )
    expect(computeContentVersion(edited)).not.toBe(computeContentVersion(requirements))
  })

  test('every job carries the content version computed from its own requirements', () => {
    for (const job of listJobs()) {
      expect(job.contentVersion, job.id).toBe(computeContentVersion(job.requirements))
    }
  })

  test('a job with no requirements is rejected by the shared schema', () => {
    const job = getJob('job-frontend-senior')
    expect(jobSchema.safeParse({ ...job, requirements: [] }).success).toBe(false)
  })
})

describe('GET /api/jobs', () => {
  let server: Server
  let url: string

  beforeAll(async () => {
    server = createApp().listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
  })

  afterAll(() => {
    server.close()
  })

  test('returns the nine seed jobs', async () => {
    const response = await fetch(`${url}/api/jobs`)

    expect(response.status).toBe(200)
    const body = jobsResponseSchema.parse(await response.json())
    expect(body.jobs.map((job) => job.id)).toEqual(PINNED_ORDER)
  })
})

describe('the synthetic demo resume', () => {
  test('is 500 to 800 words and uses only fictional contact details', () => {
    const resume = readFileSync(RESUME_PATH, 'utf8')
    const words = resume.split(/\s+/).filter((word) => word !== '')
    expect(words.length).toBeGreaterThanOrEqual(500)
    expect(words.length).toBeLessThanOrEqual(800)

    const { counts, text } = redactContactDetails(resume)
    expect(counts).toEqual({ email: 1, phone: 1, address: 1, link: 1 })
    expect(resume.match(/[^\s@]+@[^\s@]+/g)).toEqual(['sam.rivera@example.com'])
    expect(resume.match(/\+1 555 01\d\d/g)).toHaveLength(1)
    expect(resume.match(/https?:\/\/\S+/g)).toEqual(['https://example.com/sam-rivera'])
    expect(text).toContain('[email removed]')
    expect(text).toContain('[phone removed]')
    expect(text).toContain('[address removed]')
    expect(text).toContain('[link removed]')
  })
})

describe('demo pairs through the real SDK path and the stand-in model', () => {
  let fake: FakeGemini
  let server: Server
  let url: string

  beforeAll(async () => {
    fake = await startFakeGemini()
    const ai = createGeminiClient({ apiKey: 'ci-fake-key', baseUrl: fake.url })
    server = createApp({ ai }).listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
  })

  afterAll(async () => {
    server.close()
    await fake.close()
  })

  async function ratingsFor(jobId: string) {
    const resume = readFileSync(RESUME_PATH, 'utf8')
    const response = await fetch(`${url}/api/fit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId, resumeText: resume }),
    })
    expect(response.status).toBe(200)
    const body = fitResponseSchema.parse(await response.json())
    const job = getJob(jobId)
    const required = new Set(
      job?.requirements
        .filter((requirement) => requirement.kind === 'required')
        .map((requirement) => requirement.id),
    )
    return body.ratings.filter((rating) => required.has(rating.requirementId))
  }

  test('near-perfect fit: every required requirement of the senior frontend job is met', async () => {
    const required = await ratingsFor('job-frontend-senior')

    expect(required).toHaveLength(6)
    expect(required.map((rating) => rating.rating)).toEqual(Array<string>(6).fill('met'))
  })

  test('poor fit: at most one required requirement of the senior data scientist job is met', async () => {
    const required = await ratingsFor('job-data-scientist-senior')

    expect(required).toHaveLength(6)
    expect(required.filter((rating) => rating.rating === 'met').length).toBeLessThanOrEqual(1)
  })
})
