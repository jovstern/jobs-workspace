// RED-phase stand-in: an exact substring check with no normalisation. Replaced in the next commit.
export const MIN_QUOTE_LENGTH = 12

export interface ResumeIndex {
  joined: string
  separated: string
}

export function normaliseForMatch(text: string): string {
  return text
}

export function buildResumeIndex(resumeText: string): ResumeIndex {
  return { joined: resumeText, separated: resumeText }
}

export function verifyQuote(quote: string, index: ResumeIndex): boolean {
  return quote !== '' && index.separated.includes(quote)
}
