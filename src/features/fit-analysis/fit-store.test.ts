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
