import { storedAnalysisSchema } from '@jobs-workspace/shared'
import type { StoredAnalysis } from '@jobs-workspace/shared'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { z } from 'zod'

const persistedSchema = z.object({ byJobId: z.record(z.string(), storedAnalysisSchema) })

interface FitState {
  byJobId: Record<string, StoredAnalysis>
  saveAnalysis: (analysis: StoredAnalysis) => void
}

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
      // Stored data comes from an earlier session and may be damaged or edited. A value that does
      // not validate is ignored and the page starts empty (set-aside and notice are DATA-02).
      merge: (persisted, current) => {
        const parsed = persistedSchema.safeParse(persisted)
        return parsed.success ? { ...current, byJobId: parsed.data.byJobId } : current
      },
    },
  ),
)
