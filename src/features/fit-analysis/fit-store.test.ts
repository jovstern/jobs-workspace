import type { StoredAnalysis } from '@jobs-workspace/shared'
import { beforeEach, expect, test, vi } from 'vitest'

const ANALYSIS: StoredAnalysis = {
  jobId: 'job-frontend-senior',
  jobContentVersion: 'v1',
  model: 'stand-in',
  promptVersion: 'p1',
  schemaVersion: 1,
  analysedAt: '2026-10-11T10:00:00.000Z',
  ratings: [],
  advice: null,
  resumeHash: 'b'.repeat(64),
}

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

// The store reads storage when its module loads, so each case imports it fresh.
async function loadStore() {
  return (await import('./fit-store')).useFitStore
}

test('hydrates a valid stored value before the first render', async () => {
  localStorage.setItem(
    'jw:analyses',
    JSON.stringify({ state: { byJobId: { [ANALYSIS.jobId]: ANALYSIS } }, version: 1 }),
  )

  const store = await loadStore()

  expect(store.getState().byJobId[ANALYSIS.jobId]).toEqual(ANALYSIS)
})

test('ignores a stored value of the wrong shape and starts empty', async () => {
  localStorage.setItem(
    'jw:analyses',
    JSON.stringify({ state: { byJobId: { x: { not: 'an analysis' } } }, version: 1 }),
  )

  const store = await loadStore()

  expect(store.getState().byJobId).toEqual({})
})

test('ignores unparseable stored text and starts empty', async () => {
  localStorage.setItem('jw:analyses', '{not json')

  const store = await loadStore()

  expect(store.getState().byJobId).toEqual({})
})

test('saveAnalysis replaces the entry for that job and persists it', async () => {
  const store = await loadStore()

  store.getState().saveAnalysis(ANALYSIS)
  store.getState().saveAnalysis({ ...ANALYSIS, model: 'second' })

  expect(Object.keys(store.getState().byJobId)).toEqual([ANALYSIS.jobId])
  expect(store.getState().byJobId[ANALYSIS.jobId]?.model).toBe('second')
  const raw = localStorage.getItem('jw:analyses')
  expect(JSON.parse(raw ?? 'null')).toMatchObject({ version: 1 })
})

test('a refresh returns the saved entries, and rehydrating twice changes nothing', async () => {
  const first = await loadStore()
  first.getState().saveAnalysis(ANALYSIS)
  first.getState().saveAnalysis({ ...ANALYSIS, jobId: 'job-other' })
  const saved = first.getState().byJobId

  // A refresh: the module is loaded again and reads what the first one wrote.
  vi.resetModules()
  const refreshed = await loadStore()
  expect(refreshed.getState().byJobId).toEqual(saved)

  await refreshed.persist.rehydrate()
  await refreshed.persist.rehydrate()

  expect(refreshed.getState().byJobId).toEqual(saved)
  expect(Object.keys(refreshed.getState().byJobId).sort()).toEqual([
    'job-frontend-senior',
    'job-other',
  ])
})

test('re-running a check for a job replaces its entry instead of adding a second', async () => {
  const store = await loadStore()

  store.getState().saveAnalysis(ANALYSIS)
  store.getState().saveAnalysis({ ...ANALYSIS, analysedAt: '2026-10-12T10:00:00.000Z' })
  await store.persist.rehydrate()

  expect(Object.keys(store.getState().byJobId)).toEqual([ANALYSIS.jobId])
  expect(store.getState().byJobId[ANALYSIS.jobId]?.analysedAt).toBe('2026-10-12T10:00:00.000Z')
})

test('stored entries carry advice null and a 64 character resume hash, and no score or band', async () => {
  const store = await loadStore()
  store.getState().saveAnalysis(ANALYSIS)

  const raw: unknown = JSON.parse(localStorage.getItem('jw:analyses') ?? 'null')
  const entry = (raw as { state: { byJobId: Record<string, Record<string, unknown>> } }).state
    .byJobId[ANALYSIS.jobId]

  expect(entry?.advice).toBeNull()
  expect(entry?.resumeHash).toMatch(/^[0-9a-f]{64}$/)
  expect(entry).not.toHaveProperty('score')
  expect(entry).not.toHaveProperty('band')
})

test('an entry whose resume hash is not 64 hex characters leaves the store empty', async () => {
  localStorage.setItem(
    'jw:analyses',
    JSON.stringify({
      state: { byJobId: { [ANALYSIS.jobId]: { ...ANALYSIS, resumeHash: 'short' } } },
      version: 1,
    }),
  )

  const store = await loadStore()

  expect(store.getState().byJobId).toEqual({})
})
