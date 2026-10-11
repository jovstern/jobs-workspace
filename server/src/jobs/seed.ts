import { createHash } from 'node:crypto'

import { jobSchema } from '@jobs-workspace/shared'
import type { Job, Requirement } from '@jobs-workspace/shared'

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

// Seed job ids and requirement ids are hand-assigned and must never change: stored analyses and,
// from Phase 3, tracked applications are keyed by them.
const frontendRequirements: Requirement[] = [
  {
    id: 'fe-sr-r1',
    kind: 'required',
    skill: 'React',
    text: 'Five or more years building production web applications with React, including hooks, context and component composition.',
  },
  {
    id: 'fe-sr-r2',
    kind: 'required',
    skill: 'TypeScript',
    text: 'Strong TypeScript: you model data with precise types and keep strict mode on in large codebases.',
  },
  {
    id: 'fe-sr-r3',
    kind: 'required',
    skill: 'Accessibility',
    text: 'Hands-on experience building accessible interfaces to WCAG 2.2, including keyboard support and screen reader testing.',
  },
  {
    id: 'fe-sr-r4',
    kind: 'required',
    skill: 'Testing',
    text: 'You write automated tests for the front end, from component tests to browser end-to-end tests.',
  },
  {
    id: 'fe-sr-r5',
    kind: 'required',
    skill: 'Performance',
    text: 'You measure and improve front-end performance, such as bundle size, rendering cost and Core Web Vitals.',
  },
  {
    id: 'fe-sr-r6',
    kind: 'required',
    skill: 'Design systems',
    text: 'Experience building or maintaining a shared design system or component library used by several teams.',
  },
  {
    id: 'fe-sr-r7',
    kind: 'nice_to_have',
    skill: 'GraphQL',
    text: 'Experience consuming GraphQL APIs from a client application.',
  },
  {
    id: 'fe-sr-r8',
    kind: 'nice_to_have',
    skill: 'Mentoring',
    text: 'You have mentored other engineers and enjoy helping a team raise its craft.',
  },
]

const frontendSenior: Job = {
  id: 'job-frontend-senior',
  title: 'Senior Frontend Engineer',
  company: 'Brightwell Labs',
  level: 'Senior',
  location: 'Remote (Europe)',
  summary: [
    'Brightwell Labs builds planning tools for small logistics teams. You will own the web client that dispatchers use all day, from the route board to the shift calendar.',
    'You will work with two designers and four engineers, shape the component library, and set the bar for accessibility and speed across the product.',
  ],
  requirements: frontendRequirements,
  contentVersion: computeContentVersion(frontendRequirements),
}

// Validated when the module loads so a bad seed fails fast.
const jobs: Job[] = [frontendSenior].map((job) => jobSchema.parse(job))

export function listJobs(): Job[] {
  return jobs
}

export function getJob(id: string): Job | undefined {
  return jobs.find((job) => job.id === id)
}
