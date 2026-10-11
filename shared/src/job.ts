import { z } from 'zod'

// Controlled vocabulary for a requirement's skill label. Reserved for Phase 01.2's "I do have
// this"; in Phase 1 only the stand-in model reads it. It is not part of a job's contentVersion.
export const SKILL_VOCABULARY = [
  'React',
  'TypeScript',
  'JavaScript',
  'HTML and CSS',
  'Accessibility',
  'Testing',
  'Performance',
  'Design systems',
  'State management',
  'GraphQL',
  'REST APIs',
  'Node.js',
  'Python',
  'Java',
  'Go',
  'SQL',
  'PostgreSQL',
  'NoSQL',
  'Distributed systems',
  'Microservices',
  'Cloud (AWS)',
  'Docker',
  'Kubernetes',
  'CI/CD',
  'Observability',
  'Security',
  'System design',
  'Data modelling',
  'Data pipelines',
  'Spark',
  'Machine learning',
  'Statistics',
  'Data visualisation',
  'Experimentation',
  'Mentoring',
  'People management',
  'Hiring',
  'Project delivery',
  'Stakeholder communication',
  'Agile',
] as const

export const skillSchema = z.enum(SKILL_VOCABULARY)
export type Skill = z.infer<typeof skillSchema>

export const requirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(['required', 'nice_to_have']),
  skill: skillSchema,
})
export type Requirement = z.infer<typeof requirementSchema>

export const jobSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  level: z.enum(['Junior', 'Mid', 'Senior', 'Staff', 'Manager']),
  location: z.string().min(1),
  summary: z.array(z.string().min(1)).min(1).max(3),
  requirements: z.array(requirementSchema).min(6).max(10),
  contentVersion: z.string().min(1),
})
export type Job = z.infer<typeof jobSchema>

export const jobsResponseSchema = z.object({ jobs: z.array(jobSchema) })
export type JobsResponse = z.infer<typeof jobsResponseSchema>
