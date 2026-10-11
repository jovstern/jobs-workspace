import { z } from 'zod'

export const RESUME_TEXT_MIN = 50
export const RESUME_TEXT_MAX = 60000

// CRLF and CR to LF, NFC, control characters other than newline and tab removed, trimmed.
function isStrippedControl(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  if (code === 0x0a || code === 0x09) return false
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f)
}

export function canonicaliseResumeText(text: string): string {
  const unified = text.replace(/\r\n?/g, '\n').normalize('NFC')
  return Array.from(unified)
    .filter((char) => !isStrippedControl(char))
    .join('')
    .trim()
}

export const resumeTextSchema = z
  .string()
  .trim()
  .min(RESUME_TEXT_MIN, 'Paste at least 50 characters of resume text.')
  .max(RESUME_TEXT_MAX, 'The text is longer than 60,000 characters. Shorten it and try again.')

// `profile` is null in Phase 1; Phase 01.2 widens it, which needs no storage migration.
export const storedResumeSchema = z.object({
  text: resumeTextSchema,
  textHash: z.string().regex(/^[0-9a-f]{64}$/),
  savedAt: z.iso.datetime(),
  profile: z.null(),
})
export type StoredResume = z.infer<typeof storedResumeSchema>
