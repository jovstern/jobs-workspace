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

function setup() {
  const report = vi.fn<Report>()
  const storage = createGuardedStorage<Counter>({
    store: 'analyses',
    version: 1,
    migrations: {},
    validate: (state) => {
      const n = (state as { n?: unknown } | null)?.n
      return typeof n === 'number' ? { state: { n }, dropped: null, droppedCount: 0 } : null
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
