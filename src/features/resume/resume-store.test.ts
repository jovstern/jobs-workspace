import { expect, test, vi } from 'vitest'

import { sha256Hex } from '../../lib/sha256'

// Synthetic resume text: a fictional person, no real contact details.
const BODY = [
  'Alex Sample, Frontend Engineer',
  'Built React single page applications for a logistics start-up over six years.',
  'Wrote TypeScript in strict mode across a shared component package.',
].join('\n')

const SAVED_AT = '2026-10-11T10:00:00.000Z'

// The store reads storage when its module loads, so each case imports it fresh. The test setup
// clears localStorage after every test.
async function loadModule() {
  vi.resetModules()
  return import('./resume-store')
}

test('builds a canonical, contact-free record with the hash of that text', async () => {
  const { buildResumeRecord } = await loadModule()
  const raw = `${BODY}\nalex.sample@example.com\n+1 555 0142\nhttps://example.com/alex`

  const { record, counts } = await buildResumeRecord(raw, SAVED_AT)

  expect(record.text).toContain('[email removed]')
  expect(record.text).toContain('[phone removed]')
  expect(record.text).toContain('[link removed]')
  expect(record.text).not.toContain('example.com')
  expect(record.textHash).toBe(await sha256Hex(record.text))
  expect(record.savedAt).toBe(SAVED_AT)
  expect(record.profile).toBeNull()
  expect(counts).toEqual({ email: 1, phone: 1, address: 0, link: 1 })
})

test('gives the same text and hash for Windows and Unix line endings', async () => {
  const { buildResumeRecord } = await loadModule()

  const unix = await buildResumeRecord(BODY, SAVED_AT)
  const windows = await buildResumeRecord(BODY.replaceAll('\n', '\r\n'), SAVED_AT)

  expect(windows.record.text).toBe(unix.record.text)
  expect(windows.record.textHash).toBe(unix.record.textHash)
})

test('gives the same text and hash for composed and decomposed accents', async () => {
  const { buildResumeRecord } = await loadModule()
  const composed = `${BODY}\nCafé René Zoë`
  const decomposed = `${BODY}\nCafé René Zoë`

  const first = await buildResumeRecord(composed, SAVED_AT)
  const second = await buildResumeRecord(decomposed, SAVED_AT)

  expect(second.record.text).toBe(first.record.text)
  expect(second.record.textHash).toBe(first.record.textHash)
})

test('reads accents, an emoji and CJK characters back from storage identical, with the same hash', async () => {
  const first = await loadModule()
  const { record } = await first.buildResumeRecord(`${BODY}\nCafé 🚀 日本語のエンジニア`, SAVED_AT)
  first.useResumeStore.getState().saveResume(record)

  const second = await loadModule()
  const stored = second.useResumeStore.getState().resume

  expect(stored).toEqual(record)
  expect(await sha256Hex(stored?.text ?? '')).toBe(record.textHash)
})

test('gives the same hash when the same text is built twice', async () => {
  const { buildResumeRecord } = await loadModule()

  const first = await buildResumeRecord(BODY, SAVED_AT)
  const second = await buildResumeRecord(BODY, SAVED_AT)

  expect(second.record.textHash).toBe(first.record.textHash)
})

test('keeps the saved record across a rehydrate, and a second rehydrate changes nothing', async () => {
  const { buildResumeRecord, useResumeStore } = await loadModule()
  const { record } = await buildResumeRecord(BODY, SAVED_AT)
  useResumeStore.getState().saveResume(record)

  await useResumeStore.persist.rehydrate()
  const afterFirst = useResumeStore.getState().resume
  await useResumeStore.persist.rehydrate()
  const afterSecond = useResumeStore.getState().resume

  expect(afterFirst).toEqual(record)
  expect(afterSecond).toEqual(record)
  expect(JSON.parse(localStorage.getItem('jw:resume') ?? 'null')).toMatchObject({
    version: 1,
    state: { resume: { textHash: record.textHash, profile: null } },
  })
})

test('leaves the resume empty for a stored value of the wrong shape', async () => {
  localStorage.setItem(
    'jw:resume',
    JSON.stringify({ state: { resume: { text: 'too short' } }, version: 1 }),
  )

  const { useResumeStore } = await loadModule()

  expect(useResumeStore.getState().resume).toBeNull()
})

test('rejects text under 50 characters after trimming with the shared message', async () => {
  const { buildResumeRecord } = await loadModule()

  await expect(buildResumeRecord('   too short   ', SAVED_AT)).rejects.toThrow(
    'Paste at least 50 characters of resume text.',
  )
})
