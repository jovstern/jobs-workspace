import { adviceSchema } from '@jobs-workspace/shared'
import type { Job, RatedRequirement } from '@jobs-workspace/shared'
import { describe, expect, test } from 'vitest'

import { buildAdvice } from './advice'
import { buildResumeIndex } from './quotes'

// Synthetic data only: an invented posting and an invented resume.
const JOB: Job = {
  id: 'job-test',
  title: 'Platform Engineer',
  company: 'Examplia Works',
  level: 'Mid',
  location: 'Remote',
  summary: ['Examplia Works runs small platforms.'],
  requirements: [
    { id: 'r1', kind: 'required', skill: 'React', text: 'Build interfaces with React.' },
    { id: 'r2', kind: 'required', skill: 'Testing', text: 'Write automated tests.' },
    { id: 'r3', kind: 'required', skill: 'GraphQL', text: 'Consume GraphQL APIs.' },
    { id: 'r4', kind: 'required', skill: 'Docker', text: 'Package services with Docker.' },
    { id: 'r5', kind: 'nice_to_have', skill: 'Mentoring', text: 'Mentor other engineers.' },
    { id: 'r6', kind: 'nice_to_have', skill: 'Agile', text: 'Work in sprints.' },
  ],
  contentVersion: 'test-1',
}

const RESUME = [
  'Built React apps for a logistics start-up.',
  'Wrote unit tests for the checkout flow.',
  'Mentored two junior engineers through release week.',
].join('\n')
const INDEX = buildResumeIndex(RESUME)

function rated(requirementId: string, rating: RatedRequirement['rating']): RatedRequirement {
  return { requirementId, rating, quote: null, rationale: 'Test.', quoteRejected: false }
}

// r1 and r2 are met; r3 to r6 are gaps.
const RATINGS: RatedRequirement[] = [
  rated('r1', 'met'),
  rated('r2', 'met'),
  rated('r3', 'not_evidenced'),
  rated('r4', 'partial'),
  rated('r5', 'not_evidenced'),
  rated('r6', 'not_evidenced'),
]

function plan(requirementId: string, overrides: Record<string, unknown> = {}): unknown {
  return {
    requirementId,
    steps: ['Read the official guide.', 'Build a small example.'],
    whyItMatters: 'The role asks for it.',
    effort: 'weeks',
    ...overrides,
  }
}

function run(rawPlans: unknown, rawTailoring: unknown = null) {
  return buildAdvice({ rawPlans, rawTailoring, job: JOB, ratings: RATINGS, index: INDEX })
}

describe('plan steps', () => {
  test('a step with a link is dropped and the other steps of the plan are kept', () => {
    const { advice, stats } = run([
      plan('r3', {
        steps: ['See https://example.com/course for an introduction', 'a', 'b', 'c', 'd', 'e'],
      }),
    ])

    expect(advice.plans).toHaveLength(1)
    expect(advice.plans[0]?.steps).toEqual(['a', 'b', 'c', 'd'])
    expect(stats.stepsDropped).toBe(1)
  })

  test('a plan with more than 4 usable steps keeps the first 4', () => {
    const { advice } = run([plan('r3', { steps: ['a', 'b', 'c', 'd', 'e', 'f'] })])

    expect(advice.plans[0]?.steps).toEqual(['a', 'b', 'c', 'd'])
  })

  test('a plan with one usable step is kept with that one step', () => {
    const { advice } = run([plan('r3', { steps: ['https://example.com', 'Only this step'] })])

    expect(advice.plans[0]?.steps).toEqual(['Only this step'])
  })

  test('a plan whose steps are all unusable is dropped', () => {
    const { advice } = run([plan('r3', { steps: ['', 'www.example.com', '   '] })])

    expect(advice.plans).toEqual([])
  })

  test('a step that is empty, too long, not a string or names a learning platform is dropped', () => {
    const { advice } = run([
      plan('r3', {
        steps: ['   ', 'x'.repeat(201), 42, null, 'Take a Udemy course', 'Keep this one'],
      }),
    ])

    expect(advice.plans[0]?.steps).toEqual(['Keep this one'])
  })

  test('kept steps are returned as received apart from surrounding whitespace', () => {
    const { advice } = run([plan('r3', { steps: ['  Read the guide, then try it.  '] })])

    expect(advice.plans[0]?.steps).toEqual(['Read the guide, then try it.'])
  })

  test('a step is never edited to remove a link from inside it', () => {
    const { advice } = run([
      plan('r3', { steps: ['Read https://example.com first', 'Plain step'] }),
    ])

    expect(advice.plans[0]?.steps).toEqual(['Plain step'])
  })
})

describe('plan fields', () => {
  test('a plan whose why text is empty, too long or has a link is dropped', () => {
    for (const whyItMatters of ['   ', 'w'.repeat(401), 'See www.example.com', 'Ask on Coursera']) {
      expect(run([plan('r3', { whyItMatters })]).advice.plans).toEqual([])
    }
  })

  test('a plan whose effort is not days, weeks or months is dropped', () => {
    expect(run([plan('r3', { effort: 'years' })]).advice.plans).toEqual([])
    expect(run([plan('r3', { effort: 3 })]).advice.plans).toEqual([])
  })

  test('a plan whose steps is not an array is dropped', () => {
    expect(run([plan('r3', { steps: 'read the guide' })]).advice.plans).toEqual([])
  })

  test('why text is returned as received apart from surrounding whitespace', () => {
    const { advice } = run([plan('r3', { whyItMatters: '  The role asks for it.  ' })])

    expect(advice.plans[0]?.whyItMatters).toBe('The role asks for it.')
  })
})

describe('which plans are kept', () => {
  test('of two plans for one requirement the first that survives is kept', () => {
    const { advice } = run([
      plan('r3', { whyItMatters: 'See www.example.com' }),
      plan('r3', { whyItMatters: 'Second plan survives.' }),
      plan('r3', { whyItMatters: 'Third plan is ignored.' }),
    ])

    expect(advice.plans).toHaveLength(1)
    expect(advice.plans[0]?.whyItMatters).toBe('Second plan survives.')
  })

  test('no plan is kept for a met requirement or for an unknown id', () => {
    const { advice } = run([plan('r1'), plan('no-such-requirement'), plan('r4')])

    expect(advice.plans.map((entry) => entry.requirementId)).toEqual(['r4'])
  })

  test('plans come out in the posting sequence', () => {
    const { advice } = run([plan('r6'), plan('r3'), plan('r5')])

    expect(advice.plans.map((entry) => entry.requirementId)).toEqual(['r3', 'r5', 'r6'])
  })

  test('plans that are not an array give no plans', () => {
    expect(run('not a list').advice).toEqual({ plans: [], tailoring: null })
    expect(run(undefined).advice).toEqual({ plans: [], tailoring: null })
  })

  test('items that are not objects are ignored', () => {
    const { advice } = run([null, 7, 'text', [], plan('r3')])

    expect(advice.plans).toHaveLength(1)
  })
})

describe('junk input', () => {
  function junk(seed: number): unknown {
    const pool: unknown[] = [
      0,
      -1,
      NaN,
      'text',
      '',
      null,
      undefined,
      true,
      [],
      {},
      ['x', 1, null],
      { requirementId: 'r3' },
      { requirementId: 'r3', steps: [1, 2], whyItMatters: 3, effort: {} },
      [[[]], { a: { b: [] } }],
    ]
    const pick = (offset: number) => pool[(seed * 7 + offset * 3) % pool.length]
    return seed % 5 === 0
      ? pick(0)
      : [pick(0), pick(1), { requirementId: pick(2), steps: pick(3), whyItMatters: pick(4) }]
  }

  test('200 random junk inputs give schema-valid advice and never throw', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const result = run(junk(seed), junk(seed + 1))
      expect(adviceSchema.safeParse(result.advice).success).toBe(true)
    }
  })
})

describe('tailoring tips', () => {
  const GOOD_QUOTE = 'Wrote unit tests for the checkout flow.'
  const tip = (quote: unknown, advice: unknown = 'Move this line higher.') => ({ quote, advice })
  const tailoring = (emphasise: unknown, keywords: unknown = []) => ({ emphasise, keywords })
  const tipsOf = (emphasise: unknown, index = INDEX) =>
    buildAdvice({
      rawPlans: [],
      rawTailoring: tailoring(emphasise),
      job: JOB,
      ratings: RATINGS,
      index,
    })

  test('a tip whose quote is in the resume and whose advice is clean is kept', () => {
    const { advice, stats } = tipsOf([tip(GOOD_QUOTE)])

    expect(advice.tailoring?.emphasise).toEqual([
      { quote: GOOD_QUOTE, advice: 'Move this line higher.' },
    ])
    expect(stats).toMatchObject({ tipsReceived: 1, tipsKept: 1, tailoringUsable: true })
  })

  test('a tip with an invented quote is dropped, never returned without its quote', () => {
    const { advice } = tipsOf([tip('Led a company-wide platform migration to Kubernetes.')])

    expect(advice.tailoring).toEqual({ emphasise: [], keywords: [] })
  })

  test('a quote that is only a contact-removal marker is dropped', () => {
    const index = buildResumeIndex('[email removed]\nWrote unit tests for the checkout flow.')

    expect(tipsOf([tip('[email removed]')], index).advice.tailoring?.emphasise).toEqual([])
  })

  test('a quote over 600 characters is dropped even when it is in the resume', () => {
    const long = 'Wrote unit tests for the checkout flow. '.repeat(20).trim()
    const index = buildResumeIndex(long)

    expect(long.length).toBeGreaterThan(600)
    expect(tipsOf([tip(long)], index).advice.tailoring?.emphasise).toEqual([])
  })

  test.each([
    ['empty advice', '   '],
    ['advice over 400 characters', 'a'.repeat(401)],
    ['advice with a link', 'Read more at https://example.com/tips'],
    ['advice naming a learning platform', 'Learn how on YouTube first.'],
    ['advice that is not a string', 42],
  ])('a tip with %s is dropped', (_name, adviceText) => {
    expect(tipsOf([tip(GOOD_QUOTE, adviceText)]).advice.tailoring?.emphasise).toEqual([])
  })

  test('a tip that is not an object, or has a non-string quote, is dropped', () => {
    const { advice } = tipsOf([null, 'text', tip(7), { advice: 'x' }, tip(GOOD_QUOTE)])

    expect(advice.tailoring?.emphasise).toHaveLength(1)
  })

  test('two tips with the same quote after normalising keep the first', () => {
    const { advice } = tipsOf([
      tip(GOOD_QUOTE, 'First advice.'),
      tip('  WROTE unit tests for the checkout flow', 'Second advice.'),
    ])

    expect(advice.tailoring?.emphasise).toEqual([{ quote: GOOD_QUOTE, advice: 'First advice.' }])
  })

  test('seven valid tips return the first five', () => {
    const lines = Array.from(
      { length: 7 },
      (_, n) => `Delivered project number ${String(n + 1)} on time.`,
    )
    const index = buildResumeIndex(lines.join('\n'))
    const { advice } = tipsOf(
      lines.map((line) => tip(line)),
      index,
    )

    expect(advice.tailoring?.emphasise.map((entry) => entry.quote)).toEqual(lines.slice(0, 5))
  })

  test('a quote is returned as received apart from surrounding whitespace', () => {
    const { advice } = tipsOf([tip(`  ${GOOD_QUOTE}  `)])

    expect(advice.tailoring?.emphasise[0]?.quote).toBe(GOOD_QUOTE)
  })
})

describe('tailoring keywords', () => {
  const keywordsOf = (keywords: unknown) =>
    buildAdvice({
      rawPlans: [],
      rawTailoring: { emphasise: [], keywords },
      job: {
        ...JOB,
        requirements: [
          ...JOB.requirements,
          {
            id: 'r7',
            kind: 'nice_to_have',
            skill: 'Kubernetes',
            text: 'Kubernetes, Terraform, GraphQL, Redis, Kafka, Jenkins, Grafana, Helm, Vault, Nomad.',
          },
        ],
      },
      ratings: RATINGS,
      index: INDEX,
    })

  test('a keyword that is in the posting and not in the resume is kept as written', () => {
    const { advice, stats } = keywordsOf(['  Kubernetes ', 'GraphQL'])

    expect(advice.tailoring?.keywords).toEqual(['Kubernetes', 'GraphQL'])
    expect(stats).toMatchObject({ keywordsReceived: 2, keywordsKept: 2 })
  })

  test('a keyword that is not in the posting, or that the resume uses, is dropped', () => {
    expect(keywordsOf(['Zyxwvut', 'React', 'unit tests']).advice.tailoring?.keywords).toEqual([])
  })

  test('a keyword that is too short, too long, too wordy, a link or a repeat is dropped', () => {
    const { advice } = keywordsOf([
      'K',
      'k'.repeat(41),
      'Kubernetes Terraform GraphQL Redis Kafka',
      'https://example.com',
      'Terraform',
      'terraform',
      'TERRAFORM',
      42,
      null,
    ])

    expect(advice.tailoring?.keywords).toEqual(['Terraform'])
  })

  test('eleven valid keywords return the first eight', () => {
    const words = [
      'Kubernetes',
      'Terraform',
      'GraphQL',
      'Redis',
      'Kafka',
      'Jenkins',
      'Grafana',
      'Helm',
      'Vault',
      'Nomad',
    ]
    const { advice } = keywordsOf([...words, 'Kubernetes'])

    expect(advice.tailoring?.keywords).toEqual(words.slice(0, 8))
  })
})

describe('the tailoring part as a whole', () => {
  const tailoringOf = (rawTailoring: unknown) => run([], rawTailoring)

  test.each([
    ['a string', 'tips'],
    ['an array', []],
    ['null', null],
    ['missing', undefined],
  ])('%s gives tailoring null and does not count as usable', (_name, raw) => {
    const { advice, stats } = tailoringOf(raw)

    expect(advice.tailoring).toBeNull()
    expect(stats.tailoringUsable).toBe(false)
  })

  test('an object whose emphasise is not an array gives no tips and still filters keywords', () => {
    const { advice } = tailoringOf({ emphasise: 'nope', keywords: ['GraphQL', 'Zyxwvut'] })

    expect(advice.tailoring).toEqual({ emphasise: [], keywords: ['GraphQL'] })
  })

  test('an object whose items are all dropped gives empty lists, not null', () => {
    const { advice, stats } = tailoringOf({
      emphasise: [{ quote: 'invented', advice: 'x' }],
      keywords: ['Zyxwvut'],
    })

    expect(advice.tailoring).toEqual({ emphasise: [], keywords: [] })
    expect(stats.tailoringUsable).toBe(true)
  })

  test('bad tailoring leaves the plans alone', () => {
    const { advice } = run([plan('r3')], 'not an object')

    expect(advice.plans).toHaveLength(1)
    expect(advice.tailoring).toBeNull()
  })
})
