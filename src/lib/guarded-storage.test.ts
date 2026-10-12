import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { MockInstance } from 'vitest'

import { createGuardedStorage } from './guarded-storage'
import type { StorageIncident } from './storage-incidents'

interface Counter {
  n: number
}

const KEY = 'jw:test'
const NOW = new Date('2026-10-12T09:00:00.000Z')

type Report = (incident: Omit<StorageIncident, 'id'>) => void

interface SetupOptions {
  version?: number
  migrations?: Record<number, (state: unknown) => unknown>
  now?: () => Date
  keep?: number
}

// The state is `{ n }` for the plain cases, or `{ items }` where each entry is checked on its own.
function validateCounter(state: unknown) {
  const n = (state as { n?: unknown } | null)?.n
  return typeof n === 'number' ? { state: { n }, dropped: null, droppedCount: 0 } : null
}

function setup(options: SetupOptions = {}) {
  const report = vi.fn<Report>()
  const storage = createGuardedStorage<Counter>({
    store: 'analyses',
    version: options.version ?? 1,
    migrations: options.migrations ?? {},
    validate: validateCounter,
    now: options.now ?? (() => NOW),
    keep: options.keep,
    getStorage: () => localStorage,
    report,
  })
  return { storage, report }
}

interface Items {
  items: Record<string, number>
}

function setupItems() {
  const report = vi.fn<Report>()
  const storage = createGuardedStorage<Items>({
    store: 'analyses',
    version: 1,
    migrations: {},
    validate: (state) => {
      const items = (state as { items?: unknown } | null)?.items
      if (typeof items !== 'object' || items === null || Array.isArray(items)) return null
      const good: Record<string, number> = {}
      const bad: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(items)) {
        if (typeof value === 'number') good[key] = value
        else bad[key] = value
      }
      const droppedCount = Object.keys(bad).length
      return { state: { items: good }, dropped: { items: bad }, droppedCount }
    },
    now: () => NOW,
    getStorage: () => localStorage,
    report,
  })
  return { storage, report }
}

function copyKeys(): string[] {
  return Object.keys(localStorage).filter((key) => key.startsWith(`${KEY}:corrupt:`))
}

let consoleError: MockInstance

beforeEach(() => {
  localStorage.clear()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled()
  consoleError.mockRestore()
  vi.restoreAllMocks()
})

test('nothing stored is a first run: null, no report, nothing written', () => {
  const { storage, report } = setup()

  expect(storage.getItem(KEY)).toBeNull()

  expect(report).not.toHaveBeenCalled()
  expect(localStorage.length).toBe(0)
})

test('a valid envelope returns its state and reports nothing', () => {
  localStorage.setItem(KEY, JSON.stringify({ state: { n: 3 }, version: 1 }))
  const { storage, report } = setup()

  expect(storage.getItem(KEY)).toEqual({ state: { n: 3 }, version: 1 })

  expect(report).not.toHaveBeenCalled()
  expect(copyKeys()).toEqual([])
})

test.each([
  ['text that is not JSON', '{broken'],
  ['a string', '"abc"'],
  ['an array', '[1,2]'],
  ['an object with no envelope', '{"foo":1}'],
  ['null', 'null'],
  ['a number', '5'],
  ['an empty string', ''],
  ['a state of the wrong shape', JSON.stringify({ state: { n: 'x' }, version: 1 })],
  ['a missing version', JSON.stringify({ state: { n: 1 } })],
  ['a version that is not an integer', JSON.stringify({ state: { n: 1 }, version: 'one' })],
])('%s is copied aside exactly as read and the original key is removed', (_name, raw) => {
  localStorage.setItem(KEY, raw)
  const { storage, report } = setup()

  expect(storage.getItem(KEY)).toBeNull()

  const keys = copyKeys()
  expect(keys).toEqual([`${KEY}:corrupt:${NOW.toISOString()}`])
  expect(localStorage.getItem(keys[0] ?? '')).toBe(raw)
  expect(localStorage.getItem(KEY)).toBeNull()
  expect(report).toHaveBeenCalledTimes(1)
  expect(report).toHaveBeenCalledWith({ store: 'analyses', kind: 'unreadable', copyKept: true })
})

test('the copy keeps accents, an emoji and CJK characters identical', () => {
  const raw = '{broken Café 🚀 日本語'
  localStorage.setItem(KEY, raw)
  const { storage } = setup()

  storage.getItem(KEY)

  expect(localStorage.getItem(copyKeys()[0] ?? '')).toBe(raw)
})

test('an incident never carries a stored value, an issue or an error message', () => {
  localStorage.setItem(KEY, '{secret-marker-9f3')
  const { storage, report } = setup()

  storage.getItem(KEY)

  expect(JSON.stringify(report.mock.calls)).not.toContain('secret-marker-9f3')
  expect(Object.keys(report.mock.calls[0]?.[0] ?? {}).sort()).toEqual(['copyKept', 'kind', 'store'])
})

test('a real Zustand store created with this storage is filled synchronously', () => {
  localStorage.setItem(KEY, JSON.stringify({ state: { n: 7 }, version: 1 }))
  const { storage } = setup()

  const store = create<Counter>()(persist(() => ({ n: 0 }), { name: KEY, version: 1, storage }))

  expect(store.getState().n).toBe(7)
})

test('a real Zustand store starts from its initial state when the value is unreadable', () => {
  localStorage.setItem(KEY, '{broken')
  const { storage } = setup()

  const store = create<Counter>()(persist(() => ({ n: 0 }), { name: KEY, version: 1, storage }))

  expect(store.getState().n).toBe(0)
  expect(localStorage.getItem(KEY)).toBeNull()
})

test('a version above the current one is set aside whole as newer', () => {
  const raw = JSON.stringify({ state: { n: 1 }, version: 2 })
  localStorage.setItem(KEY, raw)
  const { storage, report } = setup()

  expect(storage.getItem(KEY)).toBeNull()

  expect(localStorage.getItem(copyKeys()[0] ?? '')).toBe(raw)
  expect(localStorage.getItem(KEY)).toBeNull()
  expect(report).toHaveBeenCalledTimes(1)
  expect(report).toHaveBeenCalledWith({ store: 'analyses', kind: 'newer', copyKept: true })
})

test('a version equal to the current one loads as it is and nothing is written', () => {
  localStorage.setItem(KEY, JSON.stringify({ state: { n: 3 }, version: 2 }))
  const write = vi.spyOn(Storage.prototype, 'setItem')
  const { storage, report } = setup({ version: 2 })

  expect(storage.getItem(KEY)).toEqual({ state: { n: 3 }, version: 2 })

  expect(write).not.toHaveBeenCalled()
  expect(report).not.toHaveBeenCalled()
})

test('an older version is migrated step by step, validated and written back at once', () => {
  localStorage.setItem(KEY, JSON.stringify({ state: { count: 4 }, version: 1 }))
  const { storage, report } = setup({
    version: 3,
    migrations: {
      1: (state) => ({ n: (state as { count: number }).count }),
      2: (state) => ({ n: (state as { n: number }).n * 10 }),
    },
  })

  expect(storage.getItem(KEY)).toEqual({ state: { n: 40 }, version: 3 })

  expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({ state: { n: 40 }, version: 3 })
  expect(report).not.toHaveBeenCalled()
  expect(copyKeys()).toEqual([])
})

test('a store declared at version 2 turns a version 1 value into the version 2 shape', () => {
  localStorage.setItem(KEY, JSON.stringify({ state: { count: 5 }, version: 1 }))
  const { storage } = setup({
    version: 2,
    migrations: { 1: (state) => ({ n: (state as { count: number }).count }) },
  })

  const store = create<Counter>()(persist(() => ({ n: 0 }), { name: KEY, version: 2, storage }))

  expect(store.getState().n).toBe(5)
})

test('a missing migration step sets the value aside as unreadable', () => {
  const raw = JSON.stringify({ state: { n: 1 }, version: 1 })
  localStorage.setItem(KEY, raw)
  const { storage, report } = setup({ version: 3, migrations: { 2: (state) => state } })

  expect(storage.getItem(KEY)).toBeNull()

  expect(localStorage.getItem(copyKeys()[0] ?? '')).toBe(raw)
  expect(report).toHaveBeenCalledWith({ store: 'analyses', kind: 'unreadable', copyKept: true })
})

test('a migration step that throws sets the value aside as unreadable', () => {
  localStorage.setItem(KEY, JSON.stringify({ state: { n: 1 }, version: 1 }))
  const { storage, report } = setup({
    version: 2,
    migrations: {
      1: () => {
        throw new Error('boom')
      },
    },
  })

  expect(storage.getItem(KEY)).toBeNull()

  expect(copyKeys()).toHaveLength(1)
  expect(report).toHaveBeenCalledWith({ store: 'analyses', kind: 'unreadable', copyKept: true })
})

test('a migrated value that no longer validates is set aside as unreadable', () => {
  localStorage.setItem(KEY, JSON.stringify({ state: { n: 1 }, version: 1 }))
  const { storage, report } = setup({ version: 2, migrations: { 1: () => ({ n: 'x' }) } })

  expect(storage.getItem(KEY)).toBeNull()

  expect(report).toHaveBeenCalledWith({ store: 'analyses', kind: 'unreadable', copyKept: true })
})

test('one valid and one invalid entry: the valid one loads, the invalid one is copied aside in an envelope, and the cleaned value is written back', () => {
  localStorage.setItem(
    KEY,
    JSON.stringify({ state: { items: { a: 1, b: 'bad', c: 3 } }, version: 1 }),
  )
  const { storage, report } = setupItems()

  expect(storage.getItem(KEY)).toEqual({ state: { items: { a: 1, c: 3 } }, version: 1 })

  expect(JSON.parse(localStorage.getItem(copyKeys()[0] ?? '') ?? 'null')).toEqual({
    state: { items: { b: 'bad' } },
    version: 1,
  })
  expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({
    state: { items: { a: 1, c: 3 } },
    version: 1,
  })
  expect(report).toHaveBeenCalledTimes(1)
  expect(report).toHaveBeenCalledWith({
    store: 'analyses',
    kind: 'partial',
    dropped: 1,
    copyKept: true,
  })

  // The same value is not reported again on the next read.
  report.mockClear()
  expect(storage.getItem(KEY)).toEqual({ state: { items: { a: 1, c: 3 } }, version: 1 })
  expect(report).not.toHaveBeenCalled()
  expect(copyKeys()).toHaveLength(1)
})

test('four set-asides keep only the 3 newest copies, and other stores are untouched', () => {
  localStorage.setItem('jw:other:corrupt:2026-01-01T00:00:00.000Z', 'keep me')
  const times = [
    '2026-10-12T09:00:01.000Z',
    '2026-10-12T09:00:02.000Z',
    '2026-10-12T09:00:03.000Z',
    '2026-10-12T09:00:04.000Z',
  ]
  for (const time of times) {
    localStorage.setItem(KEY, '{broken')
    const { storage } = setup({ now: () => new Date(time) })
    storage.getItem(KEY)
  }

  expect(copyKeys()).toEqual(times.slice(1).map((time) => `${KEY}:corrupt:${time}`))
  expect(localStorage.getItem('jw:other:corrupt:2026-01-01T00:00:00.000Z')).toBe('keep me')
})

test('with exactly 3 copies nothing is removed', () => {
  for (const time of ['2026-10-12T09:00:01.000Z', '2026-10-12T09:00:02.000Z']) {
    localStorage.setItem(`${KEY}:corrupt:${time}`, 'old')
  }
  localStorage.setItem(KEY, '{broken')
  const { storage } = setup()

  storage.getItem(KEY)

  expect(copyKeys()).toHaveLength(3)
  expect(localStorage.getItem(`${KEY}:corrupt:2026-10-12T09:00:01.000Z`)).toBe('old')
})

test('two set-asides at the same instant produce two keys and neither overwrites the other', () => {
  localStorage.setItem(KEY, '{first')
  setup().storage.getItem(KEY)
  localStorage.setItem(KEY, '{second')
  setup().storage.getItem(KEY)

  const base = `${KEY}:corrupt:${NOW.toISOString()}`
  expect(copyKeys()).toEqual([base, `${base}-1`])
  expect(localStorage.getItem(base)).toBe('{first')
  expect(localStorage.getItem(`${base}-1`)).toBe('{second')
})
