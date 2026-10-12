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

import { createGuardedStorage } from '../../lib/guarded-storage'
import { sha256Hex } from '../../lib/sha256'

const persistedSchema = z.object({ resume: storedResumeSchema.nullable() })
type PersistedResume = z.infer<typeof persistedSchema>

// A value that does not validate is set aside whole; there is nothing to keep entry by entry.
const storage = createGuardedStorage<PersistedResume>({
  store: 'resume',
  version: 1,
  migrations: {},
  validate: (state) => {
    const parsed = persistedSchema.safeParse(state)
    return parsed.success ? { state: parsed.data, dropped: null, droppedCount: 0 } : null
  },
})

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
      // Reading, versioning, validating and setting aside bad data all happen in the storage.
      storage,
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
