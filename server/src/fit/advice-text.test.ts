import type { Job } from '@jobs-workspace/shared'
import { describe, expect, test } from 'vitest'

import { containsLink, keywordIsMissing, namesLearningPlatform, postingTextOf } from './advice-text'
import { buildResumeIndex } from './quotes'

describe('containsLink', () => {
  test.each([
    'https://example.com/course',
    'See http://example.com for more',
    'www.example.com',
    'coursera.org/learn/x',
    'a [intro](x) to the topic',
    'mailto:a@example.com',
    'javascript:alert(1)',
    '<a href="x">here</a>',
    'href="x"',
    'someone@example.com',
    'data:text/html,x',
  ])('flags %s', (text) => {
    expect(containsLink(text)).toBe(true)
  })

  test.each([
    'Node.js',
    'Next.js',
    'socket.io',
    'ASP.NET',
    'D3.js',
    'HTTP/2',
    'CI/CD',
    'e.g.',
    '3.5 hours',
    'Clean your data: remove duplicates first',
    'Read the official guide to React.',
  ])('does not flag %s', (text) => {
    expect(containsLink(text)).toBe(false)
  })
})

describe('namesLearningPlatform', () => {
  test('flags a platform named in any letter case', () => {
    expect(namesLearningPlatform('Take the Coursera course')).toBe(true)
    expect(namesLearningPlatform('watch it on YOUTUBE')).toBe(true)
    expect(namesLearningPlatform('Try LinkedIn Learning for this')).toBe(true)
  })

  test('does not flag ordinary text or a longer word that merely starts with a name', () => {
    expect(namesLearningPlatform('Record a short demo')).toBe(false)
    expect(namesLearningPlatform('Udemyish')).toBe(false)
  })
})

// Synthetic text only. The resume and the posting are the strings the keyword table is defined on.
const RESUME = [
  'Built React/Redux apps with Node services and unit tests.',
  'Shipped small Go tools.',
  'Full-',
  'stack delivery for two product teams.',
].join('\n')
const POSTING =
  'Strong Node.js and C++ skills; CI/CD pipelines, GraphQL APIs, A/B testing, React and Redux, unit test, full-stack, Kubernetes, Terraform'

describe('keywordIsMissing', () => {
  const resume = buildResumeIndex(RESUME)

  test.each(['C++', 'CI/CD', 'GraphQL', 'A/B testing', 'Kubernetes'])(
    'keeps %s: in the posting and not in the resume',
    (keyword) => {
      expect(keywordIsMissing(keyword, POSTING, resume)).toBe(true)
    },
  )

  test.each([
    ['Node.js', 'the resume says Node'],
    ['React', 'the resume has React/Redux'],
    ['Redux', 'the resume has React/Redux'],
    ['unit tests', 'the resume has unit tests'],
    ['full stack', 'the resume has a hyphenated line end'],
    ['Go', 'in the resume, not in the posting'],
    ['Rust', 'in neither'],
  ])('drops %s (%s)', (keyword) => {
    expect(keywordIsMissing(keyword, POSTING, resume)).toBe(false)
  })

  test('ignores letter case', () => {
    expect(keywordIsMissing('graphql', POSTING, resume)).toBe(true)
    expect(keywordIsMissing('GRAPHQL', POSTING, resume)).toBe(true)
    expect(keywordIsMissing('REACT', POSTING, resume)).toBe(false)
  })

  test('a resume that says Node.js makes the keyword Node not missing', () => {
    const nodeResume = buildResumeIndex('Ran Node.js services for a freight start-up.')

    expect(keywordIsMissing('Node', 'We use Node every day.', nodeResume)).toBe(false)
  })

  test('a word inside a longer word is not a match', () => {
    const javaScriptResume = buildResumeIndex('Wrote JavaScript for the dispatch board.')

    expect(keywordIsMissing('Java', 'Experience with Java services.', javaScriptResume)).toBe(true)
  })

  test('an empty keyword is never missing', () => {
    expect(keywordIsMissing('   ', POSTING, resume)).toBe(false)
  })
})

describe('postingTextOf', () => {
  test('joins the title, the summary paragraphs and the requirement texts with newlines', () => {
    const job: Job = {
      id: 'j',
      title: 'Platform Engineer',
      company: 'Examplia Works',
      level: 'Mid',
      location: 'Remote',
      summary: ['First paragraph.', 'Second paragraph.'],
      requirements: [
        { id: 'r1', kind: 'required', skill: 'React', text: 'Build with React.' },
        { id: 'r2', kind: 'required', skill: 'Testing', text: 'Write tests.' },
      ],
      contentVersion: 'v1',
    }

    expect(postingTextOf(job)).toBe(
      'Platform Engineer\nFirst paragraph.\nSecond paragraph.\nBuild with React.\nWrite tests.',
    )
  })
})
