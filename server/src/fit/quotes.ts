// Decides whether a quote the model gave really occurs in the resume text that was sent. A pure
// text check: no model call, no fuzzy matching, no similarity threshold. A quote either occurs
// in the text or it does not.
//
// Both sides go through one normaliser, so differences that come from PDF extraction (ligatures,
// bullets, smart quotes, dash variants, line breaks, hyphenation) do not turn real evidence into
// a rejected quote, while a paraphrase or an invented sentence still fails.

import { stripContactPlaceholders } from '@jobs-workspace/shared'

// A quote shorter than this, once normalised and with any contact-removal placeholders taken out,
// is too small to count as evidence.
export const MIN_QUOTE_LENGTH = 12

export interface ResumeIndex {
  // The resume with a hyphen at the end of a line joined to the next word ("full-" "stack" is
  // "fullstack").
  joined: string
  // The resume with that hyphen read as a separator ("full-" "stack" is "full stack").
  separated: string
}

const SOFT_HYPHEN = '\u00AD'
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g
const SOFT_HYPHEN_AT_LINE_END = /\u00AD(?=[ \t]*\r?\n)/g
const LINE_END_HYPHEN = /(\p{L})-[ \t]*\r?\n[ \t]*(\p{L})/gu
// Hyphens, dashes and minus signs of every width, all read as a plain hyphen.
const DASHES = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g
const SINGLE_QUOTES = /[\u2018\u2019\u201A\u201B\u2032]/g
const DOUBLE_QUOTES = /[\u201C\u201D\u201E\u201F\u2033]/g
// Everything that is not a letter, a digit or one of % + # . / @ ' " $ becomes a separator. Those
// characters stay so that C++, C#, .NET, 3.8 and 50% survive.
const SEPARATOR_RUN = /[^\p{L}\p{N}%+#./@'"$]+/gu
const ELLIPSIS = /\.{3,}/

// Unicode compatibility form (ligatures, full-width forms and non-breaking spaces fold to their
// plain equivalents; a single ellipsis character becomes "..."), then quotes and dashes mapped
// to plain forms and invisible characters removed. A soft hyphen at the end of a line is a real
// hyphenation point, so it becomes a hyphen before the rest are dropped.
function canonicalise(text: string): string {
  return text
    .normalize('NFKC')
    .replace(SOFT_HYPHEN_AT_LINE_END, '-')
    .replaceAll(SOFT_HYPHEN, '')
    .replace(ZERO_WIDTH, '')
    .replace(DASHES, '-')
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
}

// A period inside a token stays (node.js, 3.8, e.g.). One at either end of a token is sentence
// punctuation, or part of a leading "." such as ".NET", and is dropped on both sides, so a quote
// that gains or loses a final full stop still matches.
const EDGE_PERIODS = /^\.+|\.+$/g

function collapse(canonical: string): string {
  return canonical
    .toLowerCase()
    .replace(SEPARATOR_RUN, ' ')
    .split(' ')
    .map((token) => token.replace(EDGE_PERIODS, ''))
    .filter((token) => token !== '')
    .join(' ')
}

// The form both the resume and a quote are compared in.
export function normaliseForMatch(text: string): string {
  return collapse(canonicalise(text))
}

export function buildResumeIndex(resumeText: string): ResumeIndex {
  const canonical = canonicalise(resumeText)
  return {
    joined: collapse(canonical.replace(LINE_END_HYPHEN, '$1$2')),
    separated: collapse(canonical),
  }
}

// Where a segment of an ellipsis quote may sit: no further than this many normalised characters
// after the end of the previous segment. An ellipsis stands for a short elision inside one passage,
// not for "somewhere later in the resume".
export const MAX_SEGMENT_GAP = 200

// Every segment of an ellipsis quote must be substantial on its own, so that single words picked
// from different lines cannot be stitched into a "quote".
export const MIN_SEGMENT_LENGTH = 8

interface Segment {
  // The normalised segment, searched for in the resume.
  text: string
  // How much of it is real resume text rather than a contact-removal placeholder.
  evidence: number
}

function toSegment(raw: string): Segment {
  return { text: collapse(raw), evidence: collapse(stripContactPlaceholders(raw)).length }
}

// A match must start and end on a word boundary of the normalised text, where a boundary is the
// edge of the text or a space. "ython scripting" is not a quote of "python scripting".
function isWordBounded(text: string, at: number, length: number): boolean {
  const end = at + length
  return (at === 0 || text[at - 1] === ' ') && (end === text.length || text[end] === ' ')
}

// The first word-bounded occurrence of the segment at or after `from`, or -1.
function findBounded(text: string, segment: string, from: number): number {
  let at = text.indexOf(segment, from)
  while (at !== -1 && !isWordBounded(text, at, segment.length)) {
    at = text.indexOf(segment, at + 1)
  }
  return at
}

// True when every segment occurs in the text on word boundaries, one after another, without
// overlapping, and within MAX_SEGMENT_GAP of the one before. Taking the earliest match each time is
// enough: a later one could only be further from the previous segment.
function occursInOrder(segments: readonly Segment[], text: string): boolean {
  let from = 0
  let first = true
  for (const { text: segment } of segments) {
    const at = findBounded(text, segment, from)
    if (at === -1) return false
    if (!first && at - from > MAX_SEGMENT_GAP) return false
    first = false
    from = at + segment.length
  }
  return true
}

// A placeholder such as "[email removed]" stands where the resume held contact details. It is in
// the text that was sent, so it can be matched, but it says nothing about the person's work. It
// does not count towards the minimum length, and it may not make up more than half of a quote.
function isMostlyEvidence(segments: readonly Segment[]): boolean {
  const total = segments.reduce((sum, segment) => sum + segment.text.length, 0)
  const evidence = segments.reduce((sum, segment) => sum + segment.evidence, 0)
  return evidence >= MIN_QUOTE_LENGTH && evidence * 2 >= total
}

// A quote is one contiguous span of the resume, or, when it contains "..." or the ellipsis
// character, several spans in order, each substantial and close to the one before. The minimum
// length applies to what is left after normalising, summed over the segments. Either reading of a
// line-end hyphen may match.
export function verifyQuote(quote: string, index: ResumeIndex): boolean {
  const segments = canonicalise(quote)
    .split(ELLIPSIS)
    .map(toSegment)
    .filter((segment) => segment.text !== '')
  if (!isMostlyEvidence(segments)) return false
  if (segments.length > 1 && segments.some((segment) => segment.evidence < MIN_SEGMENT_LENGTH)) {
    return false
  }
  return occursInOrder(segments, index.joined) || occursInOrder(segments, index.separated)
}
