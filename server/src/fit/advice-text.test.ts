import { describe, expect, test } from 'vitest'

import { containsLink, namesLearningPlatform } from './advice-text'

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
