import {
  canonicaliseResumeText,
  redactContactDetails,
  resumeTextSchema,
  storedResumeSchema,
} from '@jobs-workspace/shared'
import type { RedactionCounts, StoredResume } from '@jobs-workspace/shared'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { z } from 'zod'

import { sha256Hex } from '../../lib/sha256'

const persistedSchema = z.object({ resume: storedResumeSchema.nullable() })

interface ResumeState {
  resume: StoredResume | null
  saveResume: (record: StoredResume) => void
}

// The resume is the user's own record, so it lives in a persisted store. Storage is synchronous,
// so the store is filled before the first render. `profile` is stored as null from the start so
// Phase 01.2 can fill it without a storage migration.
export const useResumeStore = create<ResumeState>()(
  persist(
    (set) => ({
      resume: null,
      saveResume: (record) => {
        set({ resume: record })
      },
    }),
    {
      name: 'jw:resume',
      version: 1,
      partialize: (state) => ({ resume: state.resume }),
      // Stored data comes from an earlier session and may be damaged or edited. A value that does
      // not validate is ignored and the page starts empty (set-aside and notice are DATA-02).
      merge: (persisted, current) => {
        const parsed = persistedSchema.safeParse(persisted)
        return parsed.success ? { ...current, resume: parsed.data.resume } : current
      },
    },
  ),
)

// The only way a stored resume is built, so nothing is saved or sent without contact removal:
// canonical text, contact details and links removed, length checked on the result, then hashed.
// `savedAt` is an argument so this function has no hidden clock.
export async function buildResumeRecord(
  rawText: string,
  savedAt: string,
): Promise<{ record: StoredResume; counts: RedactionCounts }> {
  const { text: redacted, counts } = redactContactDetails(canonicaliseResumeText(rawText))
  const checked = resumeTextSchema.safeParse(redacted)
  if (!checked.success) {
    throw new Error(checked.error.issues[0]?.message ?? 'This text cannot be used.')
  }
  const text = checked.data
  return { record: { text, textHash: await sha256Hex(text), savedAt, profile: null }, counts }
}
