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

// The incident store is a module too: it must come from the same fresh module graph as the store.
async function loadWithIncidents() {
  const store = await loadStore()
  const incidents = (await import('../../lib/storage-incidents')).useStorageIncidents
  return { store, incidents }
}

function copyKeys(): string[] {
  return Object.keys(localStorage).filter((key) => key.startsWith('jw:analyses:corrupt:'))
}

test('hydrates a valid stored value before the first render', async () => {
  localStorage.setItem(
    'jw:analyses',
    JSON.stringify({ state: { byJobId: { [ANALYSIS.jobId]: ANALYSIS } }, version: 1 }),
  )

  const store = await loadStore()

  expect(store.getState().byJobId[ANALYSIS.jobId]).toEqual(ANALYSIS)
})

test('sets aside a stored entry of the wrong shape, reports it, and starts empty', async () => {
  localStorage.setItem(
    'jw:analyses',
    JSON.stringify({ state: { byJobId: { x: { not: 'an analysis' } } }, version: 1 }),
  )

  const { store, incidents } = await loadWithIncidents()

  expect(store.getState().byJobId).toEqual({})
  expect(copyKeys()).toHaveLength(1)
  expect(JSON.parse(localStorage.getItem(copyKeys()[0] ?? '') ?? 'null')).toEqual({
    state: { byJobId: { x: { not: 'an analysis' } } },
    version: 1,
  })
  expect(incidents.getState().incidents).toMatchObject([
    { store: 'analyses', kind: 'partial', dropped: 1, copyKept: true },
  ])
})

test('sets aside unparseable stored text, reports it, and starts empty', async () => {
  localStorage.setItem('jw:analyses', '{not json')

  const { store, incidents } = await loadWithIncidents()

  expect(store.getState().byJobId).toEqual({})
  expect(copyKeys()).toHaveLength(1)
  expect(localStorage.getItem(copyKeys()[0] ?? '')).toBe('{not json')
  expect(localStorage.getItem('jw:analyses')).toBeNull()
  expect(incidents.getState().incidents).toHaveLength(1)
})

test('a Phase 1 shaped value loads unchanged, reports nothing, and is not rewritten', async () => {
  const raw = JSON.stringify({ state: { byJobId: { [ANALYSIS.jobId]: ANALYSIS } }, version: 1 })
  localStorage.setItem('jw:analyses', raw)

  const { store, incidents } = await loadWithIncidents()

  expect(store.getState().byJobId[ANALYSIS.jobId]).toEqual(ANALYSIS)
  expect(incidents.getState().incidents).toEqual([])
  expect(localStorage.getItem('jw:analyses')).toBe(raw)
  expect(copyKeys()).toEqual([])
})

test('a value whose analysis carries an advice object loads', async () => {
  const withAdvice = {
    ...ANALYSIS,
    advice: { plans: [], tailoring: null },
  }
  localStorage.setItem(
    'jw:analyses',
    JSON.stringify({ state: { byJobId: { [ANALYSIS.jobId]: withAdvice } }, version: 1 }),
  )

  const { store, incidents } = await loadWithIncidents()

  expect(store.getState().byJobId[ANALYSIS.jobId]?.advice).toEqual(withAdvice.advice)
  expect(incidents.getState().incidents).toEqual([])
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

function envelope(byJobId: Record<string, unknown>, version = 1) {
  return JSON.stringify({ state: { byJobId }, version })
}

test('one valid and one invalid saved fit check: only the invalid one is set aside, and it is not reported again', async () => {
  localStorage.setItem(
    'jw:analyses',
    envelope({ [ANALYSIS.jobId]: ANALYSIS, 'job-backend-mid': { broken: true } }),
  )

  const { store, incidents } = await loadWithIncidents()

  expect(Object.keys(store.getState().byJobId)).toEqual([ANALYSIS.jobId])
  expect(incidents.getState().incidents).toMatchObject([
    { store: 'analyses', kind: 'partial', dropped: 1, copyKept: true },
  ])
  expect(JSON.parse(localStorage.getItem(copyKeys()[0] ?? '') ?? 'null')).toEqual({
    state: { byJobId: { 'job-backend-mid': { broken: true } } },
    version: 1,
  })
  expect(JSON.parse(localStorage.getItem('jw:analyses') ?? 'null')).toEqual({
    state: { byJobId: { [ANALYSIS.jobId]: ANALYSIS } },
    version: 1,
  })

  vi.resetModules()
  const second = await loadWithIncidents()
  expect(Object.keys(second.store.getState().byJobId)).toEqual([ANALYSIS.jobId])
  expect(second.incidents.getState().incidents).toEqual([])
  expect(copyKeys()).toHaveLength(1)
})

test('an entry whose key differs from its jobId is dropped, and kept entries keep their stored order', async () => {
  const first = { ...ANALYSIS, jobId: 'job-b' }
  const second = { ...ANALYSIS, jobId: 'job-a' }
  localStorage.setItem(
    'jw:analyses',
    envelope({ 'job-b': first, 'job-wrong': ANALYSIS, 'job-a': second }),
  )

  const { store, incidents } = await loadWithIncidents()

  expect(Object.keys(store.getState().byJobId)).toEqual(['job-b', 'job-a'])
  expect(incidents.getState().incidents).toMatchObject([{ kind: 'partial', dropped: 1 }])
})

test('three invalid entries are reported as three', async () => {
  localStorage.setItem('jw:analyses', envelope({ a: 1, b: 2, c: 3, [ANALYSIS.jobId]: ANALYSIS }))

  const { incidents } = await loadWithIncidents()

  expect(incidents.getState().incidents).toMatchObject([{ kind: 'partial', dropped: 3 }])
})

test.each([
  ['a missing byJobId', JSON.stringify({ state: {}, version: 1 })],
  ['a byJobId that is an array', envelope([] as unknown as Record<string, unknown>)],
  ['a byJobId that is a string', JSON.stringify({ state: { byJobId: 'x' }, version: 1 })],
])('%s sets the whole value aside as unreadable', async (_name, raw) => {
  localStorage.setItem('jw:analyses', raw)

  const { store, incidents } = await loadWithIncidents()

  expect(store.getState().byJobId).toEqual({})
  expect(incidents.getState().incidents).toMatchObject([{ kind: 'unreadable', copyKept: true }])
  expect(localStorage.getItem(copyKeys()[0] ?? '')).toBe(raw)
})

test('a valid empty state loads with no notice', async () => {
  localStorage.setItem('jw:analyses', envelope({}))

  const { store, incidents } = await loadWithIncidents()

  expect(store.getState().byJobId).toEqual({})
  expect(incidents.getState().incidents).toEqual([])
  expect(copyKeys()).toEqual([])
})

test('a value from a newer version is set aside as newer', async () => {
  const raw = envelope({ [ANALYSIS.jobId]: ANALYSIS }, 2)
  localStorage.setItem('jw:analyses', raw)

  const { store, incidents } = await loadWithIncidents()

  expect(store.getState().byJobId).toEqual({})
  expect(incidents.getState().incidents).toMatchObject([{ kind: 'newer', copyKept: true }])
  expect(localStorage.getItem(copyKeys()[0] ?? '')).toBe(raw)
})

test('with nothing stored the page starts empty, with no notice, and writes nothing', async () => {
  const { store, incidents } = await loadWithIncidents()

  expect(store.getState().byJobId).toEqual({})
  expect(incidents.getState().incidents).toEqual([])
  expect(localStorage.length).toBe(0)
})

test('saveAnalysis does not throw when the browser refuses the write, and says so once', async () => {
  const { store, incidents } = await loadWithIncidents()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })

  expect(() => {
    store.getState().saveAnalysis(ANALYSIS)
    store.getState().saveAnalysis({ ...ANALYSIS, jobId: 'job-other' })
  }).not.toThrow()

  expect(Object.keys(store.getState().byJobId)).toEqual([ANALYSIS.jobId, 'job-other'])
  expect(incidents.getState().incidents).toMatchObject([
    { store: 'analyses', kind: 'write_failed', copyKept: false },
  ])
  vi.restoreAllMocks()
})
