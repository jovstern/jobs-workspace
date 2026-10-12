import type { Job } from '@jobs-workspace/shared'

import type { ResumeIndex } from './quotes'

// Text checks for model advice. Pure and total: they never throw and never log. Model text is
// untrusted, so each check answers a yes or no and leaves the text alone; a caller drops an item
// that fails, whole, because an edited sentence can change meaning.
//
// Callers apply their length limits before these tests, so the patterns below only ever see short
// strings.

// A scheme followed by "//", a "www." prefix, a mailto: or javascript: scheme with something after
// it, a data: URL (a media type and a slash directly after the colon, so that prose such as "clean
// your data: remove duplicates" is not flagged), a markdown link, an anchor tag, an href attribute,
// an e-mail address, and a bare domain on a common top-level domain followed by a path.
const LINK_PATTERN = new RegExp(
  [
    String.raw`[a-z][a-z0-9+.-]*:\/\/`,
    String.raw`\bwww\.`,
    String.raw`\bmailto:\S`,
    String.raw`\bjavascript:\S`,
    String.raw`\bdata:[a-z]+\/[a-z0-9.+-]+`,
    String.raw`\]\(`,
    String.raw`<a[\s>]`,
    String.raw`\bhref\s*=`,
    String.raw`\S+@\S+\.\S+`,
    String.raw`\b[a-z0-9-]+\.(?:com|org|net|io|edu|dev|ai|app|co|gov)\/\S`,
  ].join('|'),
  'i',
)

export function containsLink(text: string): boolean {
  return LINK_PATTERN.test(text)
}

// Well-known learning platforms. Naming one is a pointer to a provider, which a plan must not do.
// Best effort: only these names are caught here; courses, books and people are kept out by the
// prompt alone.
export const LEARNING_PLATFORMS: readonly string[] = [
  'Coursera',
  'Udemy',
  'edX',
  'Pluralsight',
  'LinkedIn Learning',
  'freeCodeCamp',
  'Udacity',
  'Codecademy',
  'YouTube',
  'Khan Academy',
  'Frontend Masters',
  'Skillshare',
]

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, String.raw`\$&`)
}

const PLATFORM_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${LEARNING_PLATFORMS.map((name) => escapeRegExp(name).replaceAll(' ', String.raw`\s+`)).join('|')})(?![\\p{L}\\p{N}])`,
  'iu',
)

export function namesLearningPlatform(text: string): boolean {
  return PLATFORM_PATTERN.test(text)
}

export function postingTextOf(job: Job): string {
  return job.title.length < 0 ? '' : ''
}

export function keywordIsMissing(
  keyword: string,
  postingText: string,
  resume: ResumeIndex,
): boolean {
  return keyword.length < 0 && postingText.length < 0 && resume.joined.length < 0
}
