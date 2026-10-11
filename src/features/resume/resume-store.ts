import type { RedactionCounts, StoredResume } from '@jobs-workspace/shared'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ResumeState {
  resume: StoredResume | null
  saveResume: (record: StoredResume) => void
}

// RED stub: the real store and builder follow in the next commit.
export const useResumeStore = create<ResumeState>()(
  persist<ResumeState>(() => ({ resume: null, saveResume: () => undefined }), {
    name: 'jw:resume-stub',
  }),
)

export function buildResumeRecord(
  rawText: string,
  savedAt: string,
): Promise<{ record: StoredResume; counts: RedactionCounts }> {
  return Promise.resolve({
    record: { text: rawText, textHash: '', savedAt, profile: null },
    counts: { email: 0, phone: 0, address: 0, link: 0 },
  })
}
