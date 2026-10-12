import { storedAnalysisSchema } from '@jobs-workspace/shared'
import type { StoredAnalysis } from '@jobs-workspace/shared'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { z } from 'zod'

import { createGuardedStorage } from '../../lib/guarded-storage'

const persistedSchema = z.object({ byJobId: z.record(z.string(), storedAnalysisSchema) })

interface FitState {
  byJobId: Record<string, StoredAnalysis>
  saveAnalysis: (analysis: StoredAnalysis) => void
}

const storage = createGuardedStorage<{ byJobId: Record<string, StoredAnalysis> }>({
  store: 'analyses',
  version: 1,
  migrations: {},
  validate: (state) => {
    const parsed = persistedSchema.safeParse(state)
    return parsed.success ? { state: parsed.data, dropped: null, droppedCount: 0 } : null
  },
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
