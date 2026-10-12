import type { PersistStorage, StorageValue } from 'zustand/middleware'

import { useStorageIncidents } from './storage-incidents'
import type { StorageIncident, StorageStoreName } from './storage-incidents'

export const SET_ASIDE_KEEP = 3

type Report = (incident: Omit<StorageIncident, 'id'>) => void

interface ValidResult<S> {
  state: S
  dropped: unknown
  droppedCount: number
}

interface GuardedStorageOptions<S> {
  store: StorageStoreName
  // The persist version the store is declared at.
  version: number
  // Key n turns the state stored at version n into the state of version n + 1.
  migrations: Record<number, (state: unknown) => unknown>
  // Null means the whole state is unusable. Entries it leaves out come back as `dropped`.
  validate: (state: unknown) => ValidResult<S> | null
  keep?: number
  now?: () => Date
  getStorage?: () => Storage
  report?: Report
}

interface Envelope {
  state: unknown
  version: number
}

// What Zustand writes: an object with a `state` and an integer `version`. A missing version is
// not treated as the current one, as Zustand would.
function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'state' in value &&
    'version' in value &&
    typeof value.version === 'number' &&
    Number.isInteger(value.version)
  )
}

// Reading is synchronous, which is what lets a store be filled before the first render.
export interface GuardedStorage<S> extends PersistStorage<S> {
  getItem: (name: string) => StorageValue<S> | null
}

// Everything about bad saved data lives here, inside the storage a Zustand store persists to.
// Zustand's own `merge` cannot tell "nothing stored" from "garbage stored", so detection has to
// happen when the value is read. Nothing in this module logs, and nothing it reports carries the
// stored value, a validation issue or an error message.
export function createGuardedStorage<S>(options: GuardedStorageOptions<S>): GuardedStorage<S> {
  const { store, version, migrations, validate } = options
  const keep = options.keep ?? SET_ASIDE_KEEP
  const now = options.now ?? (() => new Date())
  const getStorage = options.getStorage ?? (() => window.localStorage)
  const report: Report =
    options.report ??
    ((incident) => {
      useStorageIncidents.getState().report(incident)
    })

  function open(): Storage | null {
    try {
      return getStorage()
    } catch {
      return null
    }
  }

  function copyKeysOf(storage: Storage, name: string): string[] {
    const prefix = `${name}:corrupt:`
    const keys: string[] = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key?.startsWith(prefix)) keys.push(key)
    }
    // ISO timestamps sort correctly as text, and a "-1" suffix sorts after its base key.
    return keys.sort()
  }

  function pruneCopies(storage: Storage, name: string) {
    try {
      const keys = copyKeysOf(storage, name)
      for (const key of keys.slice(0, Math.max(0, keys.length - keep))) {
        storage.removeItem(key)
      }
    } catch {
      // A copy that could not be pruned is pruned after the next set-aside.
    }
  }

  function writeCopy(storage: Storage, name: string, text: string) {
    const base = `${name}:corrupt:${now().toISOString()}`
    let key = base
    for (let suffix = 1; storage.getItem(key) !== null; suffix += 1) {
      key = `${base}-${String(suffix)}`
    }
    storage.setItem(key, text)
    pruneCopies(storage, name)
  }

  // Copies the text exactly as given to a new key. A full disk is the usual reason a copy fails,
  // so the older copies of this store are given up once and the write is tried again. Returns
  // whether a copy now exists.
  function setAside(storage: Storage, name: string, text: string): boolean {
    try {
      writeCopy(storage, name, text)
      return true
    } catch {
      // Fall through to the retry.
    }
    try {
      for (const key of copyKeysOf(storage, name)) storage.removeItem(key)
      writeCopy(storage, name, text)
      return true
    } catch {
      return false
    }
  }

  // The whole value is unusable: copy it aside and, only if the copy exists, remove the original.
  function setAsideWhole(
    storage: Storage,
    name: string,
    raw: string,
    kind: 'unreadable' | 'newer',
  ): null {
    const copyKept = setAside(storage, name, raw)
    if (copyKept) {
      try {
        storage.removeItem(name)
      } catch {
        // The copy exists; a stuck original is replaced by the next save.
      }
    }
    report({ store, kind, copyKept })
    return null
  }

  return {
    getItem: (name): StorageValue<S> | null => {
      const storage = open()
      let raw: string | null
      try {
        raw = storage ? storage.getItem(name) : null
      } catch {
        report({ store, kind: 'write_failed', copyKept: false })
        return null
      }
      if (storage === null) {
        report({ store, kind: 'write_failed', copyKept: false })
        return null
      }
      if (raw === null) return null

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return setAsideWhole(storage, name, raw, 'unreadable')
      }
      if (!isEnvelope(parsed)) return setAsideWhole(storage, name, raw, 'unreadable')
      // Never run a reader for the current version over data a newer version wrote.
      if (parsed.version > version) return setAsideWhole(storage, name, raw, 'newer')

      let state: unknown = parsed.state
      let migrated = false
      for (let from = parsed.version; from < version; from += 1) {
        const step = migrations[from]
        if (step === undefined) return setAsideWhole(storage, name, raw, 'unreadable')
        try {
          state = step(state)
        } catch {
          return setAsideWhole(storage, name, raw, 'unreadable')
        }
        migrated = true
      }

      let result: ValidResult<S> | null
      try {
        result = validate(state)
      } catch {
        result = null
      }
      if (result === null) return setAsideWhole(storage, name, raw, 'unreadable')

      let copyKept = true
      if (result.droppedCount > 0) {
        // The same envelope as live data, so a later reader can use the copy as it is.
        copyKept = setAside(storage, name, JSON.stringify({ state: result.dropped, version }))
        report({ store, kind: 'partial', copyKept, dropped: result.droppedCount })
      }
      // Without this the same entries would be found and reported again on every reload. It is
      // skipped when the dropped entries have no copy: the original is then the only record of
      // them, and the next save replaces it.
      if (copyKept && (migrated || result.droppedCount > 0)) {
        try {
          storage.setItem(name, JSON.stringify({ state: result.state, version }))
        } catch {
          report({ store, kind: 'write_failed', copyKept: false })
        }
      }
      return { state: result.state, version }
    },

    setItem: (name, value) => {
      try {
        open()?.setItem(name, JSON.stringify(value))
      } catch {
        // A failed save never fails the action that caused it: the state stays in memory and the
        // notice says the latest changes were not saved.
        report({ store, kind: 'write_failed', copyKept: false })
      }
    },

    removeItem: (name) => {
      try {
        open()?.removeItem(name)
      } catch {
        // Nothing to remove, or storage is blocked.
      }
    },
  }
}
