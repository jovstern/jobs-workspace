import { describe, expect, test } from 'vitest'

import { buildResumeIndex, MIN_QUOTE_LENGTH, normaliseForMatch, verifyQuote } from './quotes'

// Short synthetic resume snippets only: invented people, invented employers.
function accepts(resume: string, quote: string): boolean {
  return verifyQuote(quote, buildResumeIndex(resume))
}

describe('quotes that are in the resume', () => {
  const RESUME = [
    'Alex Sample, Frontend Engineer',
    'Built React single page applications for a logistics start-up over six years.',
    'Wrote TypeScript in strict mode across a shared component package.',
  ].join('\n')

  test('a verbatim quote', () => {
    expect(
      accepts(RESUME, 'Wrote TypeScript in strict mode across a shared component package.'),
    ).toBe(true)
  })

  test('the same quote with different letter case and extra whitespace', () => {
    expect(accepts(RESUME, 'wrote   TYPESCRIPT in strict\tmode  across a shared component')).toBe(
      true,
    )
  })

  test('a quote that spans a line break in the resume', () => {
    expect(accepts(RESUME, 'Frontend Engineer Built React single page applications')).toBe(true)
  })

  test('a quote that spans a hard-wrapped line', () => {
    const wrapped = 'Led the migration of the checkout flow\nto a typed component library.'

    expect(accepts(wrapped, 'migration of the checkout flow to a typed component library')).toBe(
      true,
    )
  })

  describe('line-end hyphenation', () => {
    const HYPHENATED = 'Built full-\nstack web applications for a retailer.'

    test('quoted as a hyphenated compound', () => {
      expect(accepts(HYPHENATED, 'Built full-stack web applications')).toBe(true)
    })

    test('quoted as one word', () => {
      expect(accepts(HYPHENATED, 'Built fullstack web applications')).toBe(true)
    })

    test('a word that really is one word is not rejected when the quote joins it', () => {
      expect(
        accepts(
          'Maintained the micro-\nservices behind checkout.',
          'Maintained the microservices behind checkout',
        ),
      ).toBe(true)
    })

    test('a soft hyphen at the end of a line joins the word', () => {
      expect(
        accepts('Built full\u00AD\nstack web applications.', 'Built fullstack web applications'),
      ).toBe(true)
    })
  })

  test('a ligature character in the resume against plain letters in the quote', () => {
    expect(
      accepts(
        'Led the o\uFB03ce moves and the \uFB01nance reporting.',
        'Led the office moves and the finance reporting',
      ),
    ).toBe(true)
  })

  test('a bullet in the resume against a quote without it', () => {
    expect(
      accepts(
        '\u2022 Reduced bundle size by thirty percent\n\u2022 Added tests',
        'Reduced bundle size by thirty percent',
      ),
    ).toBe(true)
  })

  test('smart quotes in the resume against straight quotes in the quote', () => {
    const resume = 'Wrote the \u201Cdesign tokens\u201D guide and the team\u2019s release notes.'

    expect(accepts(resume, 'Wrote the "design tokens" guide and the team\'s release notes')).toBe(
      true,
    )
  })

  test('an en dash in the resume against a hyphen in the quote', () => {
    expect(
      accepts(
        'Worked 2019\u20132023 on the dispatch board.',
        'Worked 2019-2023 on the dispatch board',
      ),
    ).toBe(true)
  })

  test.each([
    [
      'C++',
      'Wrote latency-critical services in C++ and C# for a freight company.',
      'services in C++ and C# for a freight',
    ],
    [
      '.NET',
      'Migrated the billing service to .NET 8 with minimal downtime.',
      'Migrated the billing service to .NET 8',
    ],
    [
      '3.8',
      'Upgraded the batch jobs to Python 3.8 and then 3.12.',
      'Upgraded the batch jobs to Python 3.8 and then 3.12',
    ],
  ])('a quote containing %s', (_name, resume, quote) => {
    expect(accepts(resume, quote)).toBe(true)
  })

  describe('sentence punctuation the model added or dropped', () => {
    const BULLET_RESUME =
      '- Reduced page load time by 40%\n- Built a design system used by 12 teams'

    test('a final full stop on a bullet that has none', () => {
      expect(accepts(BULLET_RESUME, 'Reduced page load time by 40%.')).toBe(true)
      expect(accepts(BULLET_RESUME, 'Built a design system used by 12 teams.')).toBe(true)
    })

    test('a leading full stop', () => {
      expect(accepts(BULLET_RESUME, '.Reduced page load time by 40%')).toBe(true)
    })

    test('a resume line that ends in a full stop against a quote without one', () => {
      expect(
        accepts('Wrote parsers for the billing export.', 'Wrote parsers for the billing export'),
      ).toBe(true)
    })

    test('a full stop inside a token is kept: node.js and 3.8 do not match njs or 38', () => {
      const resume = 'Upgraded the batch jobs to Python 3.8 and Node.js tooling.'

      expect(accepts(resume, 'batch jobs to Python 3.8 and Node.js')).toBe(true)
      expect(accepts(resume, 'batch jobs to Python 38 and Nodejs')).toBe(false)
    })
  })

  test('a quote with a placeholder from contact removal', () => {
    const resume = 'Reach me at [email removed] for references from my last employer.'

    expect(accepts(resume, '[email removed] for references from my last employer')).toBe(true)
  })

  describe('with an ellipsis', () => {
    const RESUME =
      'Delivered the checkout redesign for a retailer. Reduced page weight by forty percent across all routes.'

    test('where every segment occurs in the same order', () => {
      expect(
        accepts(RESUME, 'Delivered the checkout redesign ... forty percent across all routes'),
      ).toBe(true)
    })

    test('with the single ellipsis character', () => {
      expect(
        accepts(RESUME, 'Delivered the checkout redesign \u2026 forty percent across all routes'),
      ).toBe(true)
    })
  })
})

describe('quotes that are not in the resume', () => {
  const RESUME = [
    'Built React single page applications for a logistics start-up over six years.',
    'Wrote TypeScript in strict mode across a shared component package.',
    'Ran accessibility audits and fixed keyboard navigation on the dispatch board.',
  ].join('\n')

  test('a paraphrase', () => {
    expect(accepts(RESUME, 'Developed React web apps at a shipping company for six years')).toBe(
      false,
    )
  })

  test('an invented sentence', () => {
    expect(accepts(RESUME, 'Led a company-wide platform migration to Kubernetes')).toBe(false)
  })

  test('a quote under the minimum length even though it occurs', () => {
    expect(accepts(RESUME, 'strict mode')).toBe(false)
  })

  test('an ellipsis quote whose segments occur in the wrong order', () => {
    expect(
      accepts(RESUME, 'keyboard navigation on the dispatch board ... Built React single page'),
    ).toBe(false)
  })

  test('an ellipsis quote where one segment is missing', () => {
    expect(
      accepts(RESUME, 'Built React single page applications ... and ran the Kafka cluster'),
    ).toBe(false)
  })

  describe('a placeholder left by contact removal', () => {
    const REDACTED = [
      'Dana Example, Backend Engineer',
      '[email removed] | [phone removed] | [link removed]',
      '[address removed]',
      'Built payment services in Node.js for a retailer.',
    ].join('\n')

    test.each(['[email removed]', '[phone removed]', '[address removed]', '[link removed]'])(
      '%s alone is not evidence',
      (placeholder) => {
        expect(accepts(REDACTED, placeholder)).toBe(false)
      },
    )

    test('the placeholder words without brackets are not evidence either', () => {
      expect(accepts(REDACTED, 'email removed phone removed link removed')).toBe(false)
    })

    test('several placeholders together are not evidence', () => {
      expect(accepts(REDACTED, '[email removed] | [phone removed] | [link removed]')).toBe(false)
    })

    test('a placeholder with a few words of text is not evidence', () => {
      expect(accepts(REDACTED, 'Contact: [email removed]')).toBe(false)
      expect(
        accepts(REDACTED, 'Backend Engineer [email removed] | [phone removed] | [link removed]'),
      ).toBe(false)
    })
  })

  test('an empty string', () => {
    expect(accepts(RESUME, '')).toBe(false)
  })

  test('only whitespace and punctuation', () => {
    expect(accepts(RESUME, '  ...   \n\t - - - ')).toBe(false)
  })
})

describe('the minimum length', () => {
  test('is 12 normalised characters', () => {
    expect(MIN_QUOTE_LENGTH).toBe(12)
  })

  test('counts normalised characters: a quote of 12 is accepted, 11 is not', () => {
    const resume = 'Wrote parsers for the billing export.'

    expect(accepts(resume, 'Wrote parser')).toBe(true)
    expect(accepts(resume, 'Wrote parse')).toBe(false)
  })

  test('does not count whitespace padding', () => {
    expect(accepts('Wrote parsers for the billing export.', '   Wrote   parse   ')).toBe(false)
  })
})

describe('normaliseForMatch', () => {
  test('keeps the characters % + # . / @ \' " $', () => {
    expect(normaliseForMatch('50% C++ C# v3.8 a/b me@x \'q\' "q" $5')).toBe(
      '50% c++ c# v3.8 a/b me@x \'q\' "q" $5',
    )
  })

  test('collapses every other run of non-alphanumeric characters to one space', () => {
    expect(normaliseForMatch('a,;:!? b -- c\n\n(d)[e]{f}<g>*_|~^=')).toBe('a b c d e f g')
  })

  test('lower-cases and trims', () => {
    expect(normaliseForMatch('  Hello World  ')).toBe('hello world')
  })

  test('folds ligatures, full-width forms and non-breaking spaces', () => {
    expect(normaliseForMatch('\uFB01nd\u00A0\uFF21\uFF22')).toBe('find ab')
  })

  test('removes soft hyphens and zero-width characters', () => {
    expect(normaliseForMatch('ab\u00ADcd\u200Bef\uFEFFgh')).toBe('abcdefgh')
  })

  test('keeps letters from other scripts', () => {
    expect(normaliseForMatch('Zo\u00EB, Se\u00F1or')).toBe('zo\u00EB se\u00F1or')
  })
})
