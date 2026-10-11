// Decides whether a quote the model gave really occurs in the resume text that was sent. A pure
// text check: no model call, no fuzzy matching, no similarity threshold. A quote either occurs
// in the text or it does not.
//
// Both sides go through one normaliser, so differences that come from PDF extraction (ligatures,
// bullets, smart quotes, dash variants, line breaks, hyphenation) do not turn real evidence into
// a rejected quote, while a paraphrase or an invented sentence still fails.

// A quote shorter than this, once normalised, is too small to count as evidence.
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

function collapse(canonical: string): string {
  return canonical.toLowerCase().replace(SEPARATOR_RUN, ' ').trim()
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

// True when every segment occurs in the text, one after another and without overlapping.
function occursInOrder(segments: readonly string[], text: string): boolean {
  let from = 0
  for (const segment of segments) {
    const at = text.indexOf(segment, from)
    if (at === -1) return false
    from = at + segment.length
  }
  return true
}

// A quote is one contiguous span of the resume, or, when it contains "..." or the ellipsis
// character, several spans in order. The minimum length applies to what is left after
// normalising, summed over the segments. Either reading of a line-end hyphen may match.
export function verifyQuote(quote: string, index: ResumeIndex): boolean {
  const segments = canonicalise(quote)
    .split(ELLIPSIS)
    .map(collapse)
    .filter((segment) => segment !== '')
  const length = segments.reduce((total, segment) => total + segment.length, 0)
  if (length < MIN_QUOTE_LENGTH) return false
  return occursInOrder(segments, index.joined) || occursInOrder(segments, index.separated)
}
