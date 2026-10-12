import { create } from 'zustand'

export type StorageStoreName = 'resume' | 'analyses'
export type StorageIncidentKind = 'unreadable' | 'newer' | 'partial' | 'write_failed'

// An incident says which store, what happened and whether a copy was kept. It never holds a
// stored value, a validation issue or an error message: the notice only needs the facts below.
export interface StorageIncident {
  id: string
  store: StorageStoreName
  kind: StorageIncidentKind
  copyKept: boolean
  dropped?: number
}

interface StorageIncidentsState {
  incidents: StorageIncident[]
  report: (incident: Omit<StorageIncident, 'id'>) => void
  dismissAll: () => void
}

let nextId = 0

// In memory only: the bad value has already been moved aside by the time an incident exists, so
// a refresh has nothing left to report. The store is created when this module is imported, which
// is before React renders, so the notice shows from the first render.
export const useStorageIncidents = create<StorageIncidentsState>()((set) => ({
  incidents: [],
  report: (incident) => {
    set((state) => {
      // A full disk fails every save; one line per store is enough.
      if (
        incident.kind === 'write_failed' &&
        state.incidents.some((it) => it.kind === 'write_failed' && it.store === incident.store)
      ) {
        return state
      }
      nextId += 1
      return { incidents: [...state.incidents, { ...incident, id: `incident-${String(nextId)}` }] }
    })
  },
  dismissAll: () => {
    set({ incidents: [] })
  },
}))
