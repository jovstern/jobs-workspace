import { storedAnalysisSchema } from '@jobs-workspace/shared'
import type { StoredAnalysis } from '@jobs-workspace/shared'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createGuardedStorage } from '../../lib/guarded-storage'

interface FitState {
  byJobId: Record<string, StoredAnalysis>
  saveAnalysis: (analysis: StoredAnalysis) => void
}

interface PersistedFit {
  byJobId: Record<string, StoredAnalysis>
}

// Each saved analysis is checked on its own, so one bad entry never costs the others. An entry is
// accepted only when its key is exactly its job id.
function validate(state: unknown) {
  if (typeof state !== 'object' || state === null || !('byJobId' in state)) return null
  const entries: unknown = state.byJobId
  if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) return null

  const good: Record<string, StoredAnalysis> = {}
  const bad: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entries)) {
    const parsed = storedAnalysisSchema.safeParse(value)
    if (parsed.success && parsed.data.jobId === key) good[key] = parsed.data
    else bad[key] = value
  }
  const droppedCount = Object.keys(bad).length
  return {
    state: { byJobId: good },
    dropped: droppedCount > 0 ? { byJobId: bad } : null,
    droppedCount,
  }
}

// No migrations yet: nothing older than version 1 exists, and widening `advice` needed none.
const storage = createGuardedStorage<PersistedFit>({
  store: 'analyses',
  version: 1,
  migrations: {},
  validate,
})

// Fit analyses are the user's own records: paid, not repeatable, and they must outlive the
// query cache. One entry per job; saving replaces it. Storage is synchronous, so the store is
// filled before the first render.
export const useFitStore = create<FitState>()(
  persist(
    (set) => ({
      byJobId: {},
      saveAnalysis: (analysis) => {
        set((state) => ({ byJobId: { ...state.byJobId, [analysis.jobId]: analysis } }))
      },
    }),
    {
      name: 'jw:analyses',
      version: 1,
      partialize: (state) => ({ byJobId: state.byJobId }),
      // Reading, versioning, validating and setting aside bad data all happen in the storage.
      storage,
    },
  ),
)
