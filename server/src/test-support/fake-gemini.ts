// A deterministic stand-in for the Gemini API, used by tests and the browser tests. The real
// @google/genai SDK is pointed at it through GEMINI_BASE_URL, so the whole request path runs
// with no key and no network. It never needs a key and never calls out.
import { createServer } from 'node:http'
import type { IncomingHttpHeaders, IncomingMessage, Server, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { pathToFileURL } from 'node:url'

import type { Skill } from '@jobs-workspace/shared'
import { z } from 'zod'

import { getJob } from '../jobs/seed'

export type Scenario =
  | 'ok'
  | 'http_429'
  | 'http_503'
  | 'blocked'
  | 'truncated'
  | 'garbage'
  | 'slow'
  | 'hallucinated_quote'

const SCENARIOS: readonly Scenario[] = [
  'ok',
  'http_429',
  'http_503',
  'blocked',
  'truncated',
  'garbage',
  'slow',
  'hallucinated_quote',
]

const SLOW_DELAY_MS = 3000
const MAX_QUOTE_WORDS = 25
const HALLUCINATED_QUOTE =
  'Delivered a company-wide platform migration that never appears in this resume.'

// Keywords whose whole-word presence in a resume line counts as evidence of a skill. A label
// that is not listed falls back to its lower-cased text. Labels whose literal text would not
// appear in resume prose have explicit entries.
const KEYWORDS: Partial<Record<Skill, readonly string[]>> = {
  React: ['react', 'reactjs', 'react.js'],
  JavaScript: ['javascript', 'ecmascript'],
  'HTML and CSS': ['html', 'css', 'sass', 'tailwind'],
  Accessibility: ['accessibility', 'accessible', 'wcag', 'a11y', 'aria', 'screen reader'],
  Testing: ['testing', 'tests', 'vitest', 'jest', 'playwright', 'cypress', 'unit tests'],
  Performance: ['performance', 'bundle size', 'core web vitals', 'lighthouse', 'latency'],
  'Design systems': ['design system', 'design systems', 'component library', 'storybook'],
  'State management': ['state management', 'redux', 'zustand', 'mobx'],
  GraphQL: ['graphql', 'apollo'],
  'REST APIs': ['rest', 'restful', 'rest api', 'rest apis'],
  'Node.js': ['node.js', 'nodejs', 'node'],
  Python: ['python', 'django', 'flask', 'fastapi'],
  Java: ['java', 'jvm', 'kotlin'],
  Go: ['golang'],
  SQL: ['sql', 'mysql', 'sqlite'],
  PostgreSQL: ['postgresql', 'postgres', 'psql'],
  NoSQL: ['nosql', 'mongodb', 'dynamodb', 'cassandra', 'redis'],
  'Distributed systems': ['distributed systems', 'distributed system', 'kafka', 'event-driven'],
  Microservices: ['microservices', 'microservice'],
  'Cloud (AWS)': ['aws', 'amazon web services', 'ec2', 'lambda'],
  Docker: ['docker', 'dockerfile', 'containerised', 'containerized'],
  Kubernetes: ['kubernetes', 'k8s', 'helm'],
  'CI/CD': ['ci/cd', 'continuous integration', 'continuous delivery', 'github actions', 'jenkins'],
  Observability: ['observability', 'monitoring', 'tracing', 'grafana', 'datadog', 'prometheus'],
  Security: ['security', 'owasp', 'authentication', 'encryption'],
  'System design': ['system design', 'architecture', 'architected'],
  'Data modelling': ['data modelling', 'data modeling', 'schema design', 'data model'],
  'Data pipelines': ['data pipeline', 'data pipelines', 'etl', 'airflow', 'dbt'],
  Spark: ['spark', 'pyspark', 'databricks'],
  'Machine learning': ['machine learning', 'deep learning', 'pytorch', 'tensorflow'],
  Statistics: ['statistics', 'statistical', 'regression', 'bayesian'],
  'Data visualisation': ['data visualisation', 'data visualization', 'tableau', 'power bi', 'd3'],
  Experimentation: ['experimentation', 'a/b testing', 'a/b tests', 'experiments'],
  Mentoring: ['mentoring', 'mentored', 'mentor', 'coaching', 'coached'],
  'People management': ['people management', 'line management', 'direct reports', 'managed a team'],
  Hiring: ['hiring', 'hired', 'interviewing', 'recruiting', 'recruited'],
  'Project delivery': ['project delivery', 'delivered', 'roadmap', 'shipped', 'milestones'],
  'Stakeholder communication': ['stakeholder', 'stakeholders', 'cross-functional', 'presented to'],
  Agile: ['agile', 'scrum', 'kanban', 'sprint', 'sprints', 'retrospectives'],
}

// Words that show related, but not the same, experience. A line with one of these rates a
// requirement partial.
const RELATED: Partial<Record<Skill, readonly string[]>> = {
  React: ['vue', 'angular', 'svelte', 'frontend', 'front-end'],
  TypeScript: ['javascript', 'typed'],
  JavaScript: ['typescript', 'node.js'],
  'HTML and CSS': ['frontend', 'front-end', 'web'],
  Accessibility: ['keyboard', 'inclusive', 'semantic'],
  Testing: ['qa', 'quality', 'coverage'],
  Performance: ['faster', 'speed', 'caching', 'profiling'],
  'Design systems': ['components', 'ui kit', 'style guide'],
  'State management': ['state', 'context'],
  GraphQL: ['rest', 'api', 'apis'],
  'REST APIs': ['api', 'apis', 'endpoints'],
  'Node.js': ['server-side', 'backend'],
  Python: ['scripting', 'pandas'],
  Java: ['scala', 'c#'],
  Go: ['rust', 'c++'],
  SQL: ['database', 'databases', 'queries'],
  PostgreSQL: ['database', 'mysql'],
  NoSQL: ['database', 'key-value'],
  'Distributed systems': ['scalable', 'scaling', 'high availability'],
  Microservices: ['services', 'monolith'],
  'Cloud (AWS)': ['cloud', 'gcp', 'azure', 'serverless'],
  Docker: ['container', 'containers', 'compose'],
  Kubernetes: ['orchestration', 'containers'],
  'CI/CD': ['deployment', 'deployments', 'release', 'releases', 'automation'],
  Observability: ['alerts', 'dashboards', 'metrics', 'logging'],
  Security: ['auth', 'privacy', 'compliance', 'permissions'],
  'System design': ['designed', 'scalability'],
  'Data modelling': ['schema', 'schemas'],
  'Data pipelines': ['ingestion', 'batch', 'warehouse'],
  Spark: ['hadoop', 'big data'],
  'Machine learning': ['model', 'models', 'data science'],
  Statistics: ['probability', 'analytics'],
  'Data visualisation': ['charts', 'graphs', 'reporting'],
  Experimentation: ['hypothesis', 'metrics'],
  Mentoring: ['onboarding', 'pairing', 'trained', 'guided'],
  'People management': ['team lead', 'led a team', 'performance reviews'],
  Hiring: ['onboarding', 'interview', 'candidates'],
  'Project delivery': ['launched', 'coordinated', 'project', 'projects'],
  'Stakeholder communication': ['communication', 'collaborated', 'partnered'],
  Agile: ['iterations', 'backlog'],
}

function keywordsFor(skill: Skill): readonly string[] {
  return KEYWORDS[skill] ?? [skill.toLowerCase()]
}

function relatedFor(skill: Skill): readonly string[] {
  return RELATED[skill] ?? []
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}

function containsWholeWord(line: string, word: string): boolean {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, 'iu')
  return pattern.test(line)
}

function firstLineWith(lines: readonly string[], words: readonly string[]): string | null {
  return lines.find((line) => words.some((word) => containsWholeWord(line, word))) ?? null
}

interface PromptParts {
  jobId: string
  requirementIds: string[]
  resumeLines: string[]
}

const requestBodySchema = z.object({
  contents: z.array(z.object({ parts: z.array(z.object({ text: z.string().optional() })) })),
  systemInstruction: z
    .object({ parts: z.array(z.object({ text: z.string().optional() })) })
    .optional(),
})

// Reads the job id, the requirement ids and the resume from the prompt envelope.
function parsePrompt(body: unknown): PromptParts | null {
  const parsed = requestBodySchema.safeParse(body)
  if (!parsed.success) return null
  const system = parsed.data.systemInstruction?.parts.map((part) => part.text ?? '').join('') ?? ''
  if (!system.startsWith('TASK: fit-ratings')) return null
  const user = parsed.data.contents
    .flatMap((content) => content.parts.map((part) => part.text ?? ''))
    .join('')
  const jobId = /^<job id="([^"]+)">$/m.exec(user)?.[1]
  const resumeStart = user.indexOf('\n<resume>\n')
  const resumeEnd = user.lastIndexOf('\n</resume>')
  if (jobId === undefined || resumeStart === -1 || resumeEnd <= resumeStart) return null
  const requirementIds = [
    ...user.slice(0, resumeStart).matchAll(/^- \[([^\]]+)\] \((?:required|nice_to_have)\) /gm),
  ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]))
  const resume = user.slice(resumeStart + '\n<resume>\n'.length, resumeEnd)
  const resumeLines = resume
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && line.split(/\s+/).length <= MAX_QUOTE_WORDS)
  return { jobId, requirementIds, resumeLines }
}

interface FakeRating {
  requirementId: string
  quote: string | null
  rating: 'met' | 'partial' | 'not_evidenced'
  rationale: string
}

// Rule-based, not canned: the answer depends on the job and the resume in the request.
function rateFromPrompt(prompt: PromptParts, hallucinate: boolean): FakeRating[] {
  const job = getJob(prompt.jobId)
  let hallucinated = false
  return prompt.requirementIds.map((requirementId): FakeRating => {
    const skill = job?.requirements.find((requirement) => requirement.id === requirementId)?.skill
    if (skill === undefined) {
      return {
        requirementId,
        quote: null,
        rating: 'not_evidenced',
        rationale: 'Unknown requirement.',
      }
    }
    const metLine = firstLineWith(prompt.resumeLines, keywordsFor(skill))
    if (metLine !== null) {
      if (hallucinate && !hallucinated) {
        hallucinated = true
        return {
          requirementId,
          quote: HALLUCINATED_QUOTE,
          rating: 'met',
          rationale: `The resume shows ${skill}.`,
        }
      }
      return {
        requirementId,
        quote: metLine,
        rating: 'met',
        rationale: `The resume shows ${skill}.`,
      }
    }
    const partialLine = firstLineWith(prompt.resumeLines, relatedFor(skill))
    if (partialLine !== null) {
      return {
        requirementId,
        quote: partialLine,
        rating: 'partial',
        rationale: `Related experience, but not ${skill} itself.`,
      }
    }
    return {
      requirementId,
      quote: null,
      rating: 'not_evidenced',
      rationale: `No evidence of ${skill} in the resume.`,
    }
  })
}

function textResponse(text: string, finishReason: string): unknown {
  return {
    candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason }],
    usageMetadata: {
      promptTokenCount: 1200,
      candidatesTokenCount: Math.ceil(text.length / 4),
      thoughtsTokenCount: 300,
      totalTokenCount: 1500 + Math.ceil(text.length / 4),
    },
  }
}

export interface RecordedRequest {
  path: string
  headers: IncomingHttpHeaders
  body: unknown
}

export interface FakeGemini {
  url: string
  port: number
  close: () => Promise<void>
  requestCount: () => number
  lastRequest: () => RecordedRequest | null
  setScenario: (name: Scenario) => void
  reset: () => void
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    request.on('error', reject)
  })
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

const GENERATE_PATH = /^\/v1beta\/models\/[^/:]+:generateContent$/

export async function startFakeGemini(options: { port?: number } = {}): Promise<FakeGemini> {
  let scenario: Scenario = 'ok'
  let count = 0
  let last: RecordedRequest | null = null

  async function answerGenerate(request: IncomingMessage, response: ServerResponse, path: string) {
    count += 1
    const body = parseJson(await readBody(request))
    last = { path, headers: request.headers, body }

    switch (scenario) {
      case 'http_429':
        sendJson(response, 429, {
          error: { code: 429, message: 'Quota exceeded.', status: 'RESOURCE_EXHAUSTED' },
        })
        return
      case 'http_503':
        sendJson(response, 503, {
          error: { code: 503, message: 'The model is overloaded.', status: 'UNAVAILABLE' },
        })
        return
      case 'blocked':
        sendJson(response, 200, { promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } })
        return
      case 'truncated':
        sendJson(
          response,
          200,
          textResponse('{"ratings":[{"requirementId":"fe-sr-r1"', 'MAX_TOKENS'),
        )
        return
      case 'garbage':
        sendJson(response, 200, textResponse('this is not json {', 'STOP'))
        return
      case 'slow': {
        const timer = setTimeout(() => {
          sendJson(response, 200, textResponse('{"ratings":[]}', 'STOP'))
        }, SLOW_DELAY_MS)
        response.on('close', () => {
          clearTimeout(timer)
        })
        return
      }
      case 'ok':
      case 'hallucinated_quote': {
        const prompt = parsePrompt(body)
        if (prompt === null) {
          sendJson(response, 400, {
            error: { code: 400, message: 'Unrecognised prompt.', status: 'INVALID_ARGUMENT' },
          })
          return
        }
        const ratings = rateFromPrompt(prompt, scenario === 'hallucinated_quote')
        sendJson(response, 200, textResponse(JSON.stringify({ ratings }), 'STOP'))
        return
      }
    }
  }

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const method = request.method ?? 'GET'
    const path = new URL(request.url ?? '/', 'http://localhost').pathname

    if (method === 'POST' && GENERATE_PATH.test(path)) {
      await answerGenerate(request, response, path)
      return
    }
    if (method === 'POST' && path === '/__scenario') {
      const parsed = z
        .object({ name: z.enum(SCENARIOS as [Scenario, ...Scenario[]]) })
        .safeParse(parseJson(await readBody(request)))
      if (!parsed.success) {
        sendJson(response, 400, { error: 'unknown scenario' })
        return
      }
      scenario = parsed.data.name
      sendJson(response, 200, { scenario })
      return
    }
    if (method === 'POST' && path === '/__reset') {
      scenario = 'ok'
      count = 0
      last = null
      sendJson(response, 200, { generateContent: count })
      return
    }
    if (method === 'GET' && path === '/__count') {
      sendJson(response, 200, { generateContent: count })
      return
    }
    sendJson(response, 404, { error: { code: 404, message: 'Not found.', status: 'NOT_FOUND' } })
  }

  const server: Server = createServer((request, response) => {
    handle(request, response).catch(() => {
      sendJson(response, 500, {
        error: { code: 500, message: 'Stand-in failure.', status: 'INTERNAL' },
      })
    })
  })
  server.listen(options.port ?? 0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${String(port)}`,
    port,
    requestCount: () => count,
    lastRequest: () => last,
    setScenario: (name) => {
      scenario = name
    },
    reset: () => {
      scenario = 'ok'
      count = 0
      last = null
    },
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve()
        })
      })
    },
  }
}

// Program entry: `npm --prefix server run fake-gemini`.
const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const port = Number(process.env.FAKE_GEMINI_PORT ?? 3199)
  const fake = await startFakeGemini({ port })
  console.log(`fake Gemini listening on ${fake.url}`)
}
