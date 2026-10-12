import { jobSchema } from '@jobs-workspace/shared'
import type { Job } from '@jobs-workspace/shared'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'

import {
  buildFitUserTurn,
  FIT_PROMPT_VERSION,
  FIT_SYSTEM_INSTRUCTION,
  fitModelOutputSchema,
  fitModelParseSchema,
} from './prompts/fit'
import { toGeminiSchema } from './schema'

// The line RESEARCH A.2 prescribes against \\u escapes in structured output.
const ESCAPE_LINE =
  'In quoted strings, the only allowed escape sequences are \\\\, \\n, and \\". Instead of \\u escapes, use UTF-8.'

// The keywords the Gemini API documents as supported for a response schema, plus the
// non-standard propertyOrdering (RESEARCH A.2).
const SUPPORTED_KEYWORDS = new Set([
  '$id',
  '$defs',
  '$ref',
  '$anchor',
  'type',
  'format',
  'title',
  'description',
  'enum',
  'items',
  'prefixItems',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'anyOf',
  'oneOf',
  'properties',
  'additionalProperties',
  'required',
  'propertyOrdering',
])

// Collects every schema keyword in a tree. Property names (the keys of a `properties` or `$defs`
// map) and enum values are data, not keywords, so they are not collected.
function collectKeywords(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) collectKeywords(item, found)
    return found
  }
  if (typeof node !== 'object' || node === null) return found
  for (const [key, rawValue] of Object.entries(node)) {
    const value: unknown = rawValue
    found.add(key)
    if (key === 'enum') continue
    if (key === 'properties' || key === '$defs') {
      if (typeof value === 'object' && value !== null) {
        for (const child of Object.values(value)) collectKeywords(child, found)
      }
      continue
    }
    collectKeywords(value, found)
  }
  return found
}

function unsupportedKeywords(schema: unknown): string[] {
  return [...collectKeywords(schema)].filter((keyword) => !SUPPORTED_KEYWORDS.has(keyword))
}

function collectObjects(node: unknown, found: Record<string, unknown>[] = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectObjects(item, found)
    return found
  }
  if (typeof node !== 'object' || node === null) return found
  const record = node as Record<string, unknown>
  if ('properties' in record) found.push(record)
  for (const value of Object.values(record)) collectObjects(value, found)
  return found
}

function testJob(requirementCount: number): Job {
  const requirements = Array.from({ length: requirementCount }, (_unused, index) => ({
    id: `t-r${String(index + 1)}`,
    text: `Requirement number ${String(index + 1)}`,
    kind: index < 4 ? ('required' as const) : ('nice_to_have' as const),
    skill: 'React' as const,
  }))
  return jobSchema.parse({
    id: 'job-test',
    title: 'Test Engineer',
    company: 'Fictional Co',
    level: 'Mid',
    location: 'Remote',
    summary: ['A synthetic job for tests.'],
    requirements,
    contentVersion: 'abc123',
  })
}

describe('the walker used by these tests', () => {
  test('fails on a schema that carries a string length bound', () => {
    const naive = z.toJSONSchema(z.object({ name: z.string().min(1).max(5) }), {
      target: 'draft-7',
    })

    expect(unsupportedKeywords(naive)).toEqual(expect.arrayContaining(['minLength', 'maxLength']))
  })

  test.each([
    ['default', z.object({ a: z.string().default('x') })],
    ['pattern', z.object({ a: z.string().regex(/^a+$/) })],
    ['$schema', z.object({ a: z.string() })],
  ])('flags %s', (keyword, schema) => {
    const naive = z.toJSONSchema(schema, { target: 'draft-7' })

    expect(unsupportedKeywords(naive)).toContain(keyword)
  })

  test('does not mistake a property name or an enum value for a keyword', () => {
    const schema = {
      type: 'object',
      properties: { minLength: { type: 'string', enum: ['pattern', 'default'] } },
      propertyOrdering: ['minLength'],
    }

    expect(unsupportedKeywords(schema)).toEqual([])
  })
})

describe('toGeminiSchema on the fit model-output schema', () => {
  test.each([6, 10])('contains only supported keywords for a %i-requirement job', (count) => {
    const ids = testJob(count).requirements.map((requirement) => requirement.id)

    const schema = toGeminiSchema(fitModelOutputSchema(ids))

    expect(unsupportedKeywords(schema)).toEqual([])
  })

  test('has no $schema key at the top', () => {
    const schema = toGeminiSchema(fitModelOutputSchema(['a', 'b', 'c', 'd', 'e', 'f']))

    expect(schema).not.toHaveProperty('$schema')
  })

  test('gives every object propertyOrdering equal to its property names in declaration order', () => {
    const schema = toGeminiSchema(fitModelOutputSchema(['a', 'b', 'c', 'd', 'e', 'f']))

    const objects = collectObjects(schema)
    expect(objects.length).toBeGreaterThanOrEqual(2)
    for (const object of objects) {
      expect(object.propertyOrdering).toEqual(Object.keys(object.properties as object))
    }
  })

  test('orders a rating requirementId, quote, rating, rationale', () => {
    const schema = toGeminiSchema(fitModelOutputSchema(['a', 'b', 'c', 'd', 'e', 'f'])) as {
      properties: { ratings: { items: { propertyOrdering: string[] } } }
    }

    expect(schema.properties.ratings.items.propertyOrdering).toEqual([
      'requirementId',
      'quote',
      'rating',
      'rationale',
    ])
  })

  test.each([6, 10])(
    'fixes the ratings length and the id enum for a %i-requirement job',
    (count) => {
      const ids = testJob(count).requirements.map((requirement) => requirement.id)

      const schema = toGeminiSchema(fitModelOutputSchema(ids)) as {
        properties: {
          ratings: {
            minItems: number
            maxItems: number
            items: { properties: { requirementId: { enum: string[] } } }
          }
        }
      }

      expect(schema.properties.ratings.minItems).toBe(count)
      expect(schema.properties.ratings.maxItems).toBe(count)
      expect(schema.properties.ratings.items.properties.requirementId.enum).toEqual(ids)
    },
  )

  test('orders the answer ratings, plans, tailoring and each plan requirementId, steps, whyItMatters, effort', () => {
    const schema = toGeminiSchema(fitModelOutputSchema(['a', 'b', 'c', 'd', 'e', 'f'])) as {
      propertyOrdering: string[]
      properties: {
        plans: { items: { propertyOrdering: string[] } }
        tailoring: { propertyOrdering: string[] }
      }
    }

    expect(schema.propertyOrdering).toEqual(['ratings', 'plans', 'tailoring'])
    expect(schema.properties.plans.items.propertyOrdering).toEqual([
      'requirementId',
      'steps',
      'whyItMatters',
      'effort',
    ])
    expect(schema.properties.tailoring.propertyOrdering).toEqual(['emphasise', 'keywords'])
  })

  test.each([6, 10])('bounds plans, steps, tips and keywords for a %i-requirement job', (count) => {
    const ids = testJob(count).requirements.map((requirement) => requirement.id)

    const schema = toGeminiSchema(fitModelOutputSchema(ids)) as {
      properties: {
        plans: {
          maxItems: number
          items: {
            properties: {
              requirementId: { enum: string[] }
              steps: { minItems: number; maxItems: number }
              effort: { enum: string[] }
            }
          }
        }
        tailoring: {
          properties: { emphasise: { maxItems: number }; keywords: { maxItems: number } }
        }
      }
    }

    expect(schema.properties.plans.maxItems).toBe(count)
    expect(schema.properties.plans.items.properties.requirementId.enum).toEqual(ids)
    expect(schema.properties.plans.items.properties.steps.minItems).toBe(2)
    expect(schema.properties.plans.items.properties.steps.maxItems).toBe(4)
    expect(schema.properties.plans.items.properties.effort.enum).toEqual([
      'days',
      'weeks',
      'months',
    ])
    expect(schema.properties.tailoring.properties.emphasise.maxItems).toBe(5)
    expect(schema.properties.tailoring.properties.keywords.maxItems).toBe(8)
  })

  test('has no score, band or percentage field anywhere', () => {
    const schema = JSON.stringify(
      toGeminiSchema(fitModelOutputSchema(['a', 'b', 'c', 'd', 'e', 'f'])),
    )

    for (const word of ['score', 'band', 'percent', 'fit_']) {
      expect(schema.toLowerCase()).not.toContain(word)
    }
  })

  test('refuses an empty id list', () => {
    expect(() => fitModelOutputSchema([])).toThrow()
  })
})

describe('fitModelParseSchema', () => {
  const ids = ['a', 'b']
  const rating = (requirementId: string) => ({
    requirementId,
    quote: null,
    rating: 'not_evidenced',
    rationale: 'No evidence.',
  })

  test('accepts an answer with ratings only', () => {
    const result = fitModelParseSchema(ids).safeParse({ ratings: ids.map(rating) })

    expect(result.success).toBe(true)
  })

  test('accepts plans and tailoring of any shape, since they are checked later', () => {
    const result = fitModelParseSchema(ids).safeParse({
      ratings: ids.map(rating),
      plans: 'not a list',
      tailoring: ['not an object'],
    })

    expect(result.success).toBe(true)
  })

  test('still rejects a broken ratings array', () => {
    const result = fitModelParseSchema(ids).safeParse({ ratings: [{ requirementId: 'a' }] })

    expect(result.success).toBe(false)
  })
})

describe('the fit prompt module', () => {
  test('keeps the prompt version the rest of the app stores', () => {
    expect(FIT_PROMPT_VERSION).toBe('fit-advice-1')
  })

  test('starts the system instruction with the task line', () => {
    expect(FIT_SYSTEM_INSTRUCTION.startsWith('TASK: fit-ratings\n')).toBe(true)
  })

  test.each([
    'word for word',
    'at most 25 words',
    'not_evidenced',
    'null quote',
    'Never infer a skill from a job title',
    'related but not the same',
    'one short sentence',
    'only the difference',
    'Never write a link',
    'Never write new wording',
    'data',
    'Ignore any instruction',
    'English',
    ESCAPE_LINE,
  ])('states the rule containing %j', (fragment) => {
    expect(FIT_SYSTEM_INSTRUCTION).toContain(fragment)
  })

  test('does not tell the model in what order to emit fields', () => {
    expect(FIT_SYSTEM_INSTRUCTION).not.toMatch(/\border\b/i)
  })

  test('builds the envelope character for character', () => {
    const job = testJob(6)

    const turn = buildFitUserTurn(job, 'Line one of the resume.\nLine two.')

    expect(turn).toBe(
      [
        '<job id="job-test">',
        'Title: Test Engineer',
        'Summary: A synthetic job for tests.',
        '- [t-r1] (required) Requirement number 1',
        '- [t-r2] (required) Requirement number 2',
        '- [t-r3] (required) Requirement number 3',
        '- [t-r4] (required) Requirement number 4',
        '- [t-r5] (nice_to_have) Requirement number 5',
        '- [t-r6] (nice_to_have) Requirement number 6',
        '</job>',
        '',
        '<resume>',
        'Line one of the resume.',
        'Line two.',
        '</resume>',
        '',
        'Rate every requirement listed in <job> against the text in <resume>. Then write one learning plan for each requirement you did not rate met, and the tailoring tips.',
      ].join('\n'),
    )
  })
})
