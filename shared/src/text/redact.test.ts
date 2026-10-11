import { describe, expect, test } from 'vitest'

import { CONTACT_PLACEHOLDERS, redactContactDetails, stripContactPlaceholders } from './redact'

type Kind = 'email' | 'phone' | 'address' | 'link'

const PLACEHOLDER: Record<Kind, string> = {
  email: '[email removed]',
  phone: '[phone removed]',
  address: '[address removed]',
  link: '[link removed]',
}

const KINDS: readonly Kind[] = ['email', 'phone', 'address', 'link']

// Every value here is invented: example.com, the 555 01xx range, a street that does not exist.
const MUST_GO: readonly (readonly [Kind, string])[] = [
  ['email', 'dana.example@example.com'],
  ['phone', '+1 555 0100'],
  ['phone', '(555) 010-0100'],
  ['phone', '555.010.0100'],
  ['phone', '+44 20 7946 0958'],
  ['phone', '+972-50-123-4567'],
  ['phone', '050-1234567'],
  ['address', '100 Example Street'],
  ['address', '221B Baker St.'],
  ['address', '5 Main St Apt 4B, Springfield, IL 62704'],
  ['address', 'P.O. Box 1234'],
  ['link', 'https://example.com/dana'],
  ['link', 'www.example.org'],
  ['link', 'linkedin.com/in/dana-example'],
  ['link', 'github.com/dana-example'],
]

const MUST_STAY: readonly string[] = [
  '2018-06 to 2021-02',
  '2021 - 2023',
  '03/2019 - 05/2021',
  '2019–2022',
  '3.8 s to 1.6 s',
  '400-component',
  '35%',
  '10,000 users',
  'v19.2.1',
  '120 000 - 140 000',
  'Node 22.12',
  'ISO 27001',
  '24/7',
  'Node.js',
  'Vue.js',
  'Socket.IO',
  'ASP.NET',
  'e.g.',
  // Extra guards beyond the required list: other number shapes that look like phone numbers.
  '2018-06-15',
  '120000-140000',
  '$120,000-$140,000',
  '+35% revenue',
  '+10 000 - 15 000',
]

function zeroCounts(): Record<Kind, number> {
  return { email: 0, phone: 0, address: 0, link: 0 }
}

describe('what must go', () => {
  test.each(MUST_GO)('%s: %s is replaced by its placeholder', (kind, value) => {
    const result = redactContactDetails(`Reach me: ${value} thanks`)

    expect(result.text).toBe(`Reach me: ${PLACEHOLDER[kind]} thanks`)
    expect(result.text).not.toContain(value)
    expect(result.counts).toEqual({ ...zeroCounts(), [kind]: 1 })
  })

  test('removes a UK postcode on its own pattern and leaves the surrounding words', () => {
    const result = redactContactDetails('Based in London NW1 6XE since 2019')

    expect(result.text).toBe('Based in London [address removed] since 2019')
    expect(result.counts).toEqual({ ...zeroCounts(), address: 1 })
  })

  test('removes several kinds from one header and keeps the person name', () => {
    const header = 'Dana Example | dana.example@example.com | +1 555 0100 | github.com/dana-example'

    const result = redactContactDetails(header)

    expect(result.text).toBe('Dana Example | [email removed] | [phone removed] | [link removed]')
    expect(result.counts).toEqual({ email: 1, phone: 1, address: 0, link: 1 })
  })

  test('counts every match of a kind', () => {
    const result = redactContactDetails('a@example.com and b@example.com and 555.010.0100')

    expect(result.counts).toEqual({ email: 2, phone: 1, address: 0, link: 0 })
  })
})

describe('what must stay', () => {
  test.each(MUST_STAY)('%s survives byte for byte', (value) => {
    const sentence = `Used ${value} in production`

    expect(redactContactDetails(value)).toEqual({ text: value, counts: zeroCounts() })
    expect(redactContactDetails(sentence)).toEqual({ text: sentence, counts: zeroCounts() })
  })

  test('a line holding only a person name is untouched', () => {
    expect(redactContactDetails('Dana Example')).toEqual({
      text: 'Dana Example',
      counts: zeroCounts(),
    })
  })

  test('a multi-line text with nothing to remove comes back identical with four zeros', () => {
    const text = [
      'Dana Example',
      'Frontend Engineer, 2018-06 to 2021-02',
      'Cut load time from 3.8 s to 1.6 s for 10,000 users on Node.js and Vue.js.',
    ].join('\n')

    expect(redactContactDetails(text)).toEqual({ text, counts: zeroCounts() })
  })
})

describe('placeholders', () => {
  test('the exported list holds the four placeholders the redactor writes', () => {
    expect([...CONTACT_PLACEHOLDERS].sort()).toEqual(Object.values(PLACEHOLDER).sort())
  })

  test('stripContactPlaceholders removes each of them, with or without brackets', () => {
    expect(
      stripContactPlaceholders(
        'a [email removed] b [phone removed] c address removed d [link removed]',
      )
        .trim()
        .split(/\s+/)
        .join(' '),
    ).toBe('a b c d')
  })
})

describe('idempotence', () => {
  const fixtures = [
    ...MUST_GO.map(([, value]) => `Reach me: ${value} thanks`),
    ...MUST_STAY.map((value) => `Used ${value} in production`),
    'Based in London NW1 6XE since 2019',
    'Dana Example | dana.example@example.com | +1 555 0100 | github.com/dana-example',
  ]

  test.each(fixtures)('a second pass changes nothing: %s', (fixture) => {
    const first = redactContactDetails(fixture)
    const second = redactContactDetails(first.text)

    expect(second.text).toBe(first.text)
    expect(second.counts).toEqual(zeroCounts())
  })
})

describe('known limits', () => {
  // Documents current behaviour, not a goal: a number followed by a capitalised name and a
  // street-type word reads as an address, even when it is a project.
  test('25 Park Avenue project is treated as an address', () => {
    expect(redactContactDetails('25 Park Avenue project').text).toBe('[address removed] project')
  })
})

describe('speed', () => {
  const LENGTH = 60000
  const inputs: readonly (readonly [string, string])[] = [
    ['digits and dots', '1.'.repeat(LENGTH / 2)],
    ['dots and at-signs', '1.@'.repeat(LENGTH / 3)],
    ['at-signs between digit runs', '12@3.4.'.repeat(Math.ceil(LENGTH / 7)).slice(0, LENGTH)],
    ['plus signs and digit groups', '+12 345 '.repeat(LENGTH / 8)],
    ['street-like numbers', '12 Ab '.repeat(LENGTH / 6)],
  ]

  test.each(inputs)('finishes %s in under 200 ms', (_name, input) => {
    expect(input.length).toBeLessThanOrEqual(LENGTH)
    const started = performance.now()

    const result = redactContactDetails(input)

    expect(performance.now() - started).toBeLessThan(200)
    expect(KINDS.every((kind) => result.counts[kind] >= 0)).toBe(true)
  })
})
