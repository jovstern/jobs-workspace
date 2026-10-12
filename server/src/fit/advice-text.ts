import type { Job } from '@jobs-workspace/shared'

import { normaliseForMatch, occursAsPhrase } from './quotes'
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

// The text of a posting as the user can read it on the page: the title, the summary paragraphs and
// every requirement text. It is seed content, so it is trusted.
export function postingTextOf(job: Job): string {
  return [
    job.title,
    ...job.summary,
    ...job.requirements.map((requirement) => requirement.text),
  ].join('\n')
}

const TRAILING_JS = /\.js$/

function words(text: string): string[] {
  return text.split(' ').filter((word) => word !== '')
}

// "react/redux" read as two words, and "node.js" read as "node", so a resume that writes "Node" or
// "React/Redux" counts as using those words. Input is in normaliseForMatch form.
function foldText(normalised: string): string {
  return words(normalised.replaceAll('/', ' '))
    .map((word) => word.replace(TRAILING_JS, ''))
    .join(' ')
}

// The last word's plural toggled: a final "s" removed, or added when absent.
function withTogglePlural(phrase: string): string {
  const parts = words(phrase)
  const last = parts.pop()
  if (last === undefined) return phrase
  parts.push(last.endsWith('s') ? last.slice(0, -1) : `${last}s`)
  return parts.join(' ')
}

function keywordForms(keyword: string): string[] {
  const base = [keyword, words(keyword.replaceAll('/', ' ')).join(' ')]
  const withoutJs = base.map((form) => {
    const parts = words(form)
    const last = parts.pop()
    return last === undefined ? form : [...parts, last.replace(TRAILING_JS, '')].join(' ')
  })
  const forms = [...base, ...withoutJs].filter((form) => form !== '')
  return [...new Set([...forms, ...forms.map(withTogglePlural)])].filter((form) => form !== '')
}

// True when the keyword is a good one to suggest: it occurs in the posting and the resume does not
// already use it. Case, a slash, a trailing ".js", a plural "s" and a hyphen at a line end are
// folded; there is no stemming beyond that and no synonyms, and both ways of being wrong are safe (a
// keyword wrongly kept is shown with a fixed note, one wrongly dropped is simply not shown).
//
// Because a keyword must occur in the posting, which is trusted seed text, text in an untrusted
// resume cannot place an arbitrary word in the keyword list.
export function keywordIsMissing(
  keyword: string,
  postingText: string,
  resume: ResumeIndex,
): boolean {
  const forms = keywordForms(normaliseForMatch(keyword))
  if (forms.length === 0) return false

  const posting = normaliseForMatch(postingText)
  const postingForms = [posting, foldText(posting)]
  const resumeForms = [resume.joined, resume.separated].flatMap((text) => [text, foldText(text)])

  const occursIn = (texts: readonly string[]) =>
    forms.some((form) => texts.some((text) => occursAsPhrase(text, form)))
  return occursIn(postingForms) && !occursIn(resumeForms)
}
