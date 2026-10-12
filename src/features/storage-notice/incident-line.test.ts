import { expect, test } from 'vitest'

import type { StorageIncident } from '../../lib/storage-incidents'
import { incidentLine } from './incident-line'

function incident(partial: Omit<StorageIncident, 'id'>): StorageIncident {
  return { id: 'incident-1', ...partial }
}

test('resume unreadable, copy kept', () => {
  expect(incidentLine(incident({ store: 'resume', kind: 'unreadable', copyKept: true }))).toBe(
    'Your saved resume could not be read, so it was set aside and the page started without it. Add your resume again to continue. A copy is kept in this browser.',
  )
})

test('fit checks unreadable, copy kept', () => {
  expect(incidentLine(incident({ store: 'analyses', kind: 'unreadable', copyKept: true }))).toBe(
    'Your saved fit checks could not be read, so they were set aside. Run Check my fit again to rebuild them. A copy is kept in this browser.',
  )
})

test('resume from a newer version, copy kept', () => {
  expect(incidentLine(incident({ store: 'resume', kind: 'newer', copyKept: true }))).toBe(
    'Your saved resume was written by a newer version of this app, so it was set aside and the page started without it. Add your resume again to continue. A copy is kept in this browser.',
  )
})

test('fit checks from a newer version, copy kept', () => {
  expect(incidentLine(incident({ store: 'analyses', kind: 'newer', copyKept: true }))).toBe(
    'Your saved fit checks were written by a newer version of this app, so they were set aside and the page started without them. Run Check my fit again to rebuild them. A copy is kept in this browser.',
  )
})

test('some fit checks dropped, copy kept: singular for one', () => {
  expect(
    incidentLine(incident({ store: 'analyses', kind: 'partial', copyKept: true, dropped: 1 })),
  ).toBe(
    '1 saved fit check could not be read and was set aside. The others are fine. A copy is kept in this browser.',
  )
})

test('some fit checks dropped, copy kept: plural for more', () => {
  expect(
    incidentLine(incident({ store: 'analyses', kind: 'partial', copyKept: true, dropped: 3 })),
  ).toBe(
    '3 saved fit checks could not be read and were set aside. The others are fine. A copy is kept in this browser.',
  )
})

test('write failed', () => {
  expect(incidentLine(incident({ store: 'analyses', kind: 'write_failed', copyKept: false }))).toBe(
    'Your browser could not save your latest changes. Storage may be full. What you see now will be lost when you refresh.',
  )
})

const NOT_KEPT: [string, Omit<StorageIncident, 'id'>, string][] = [
  [
    'resume unreadable',
    { store: 'resume', kind: 'unreadable', copyKept: false },
    'Your saved resume could not be read, so the page started without it. A copy could not be kept, and the unreadable data will be replaced the next time you save. Add your resume again to continue.',
  ],
  [
    'fit checks unreadable',
    { store: 'analyses', kind: 'unreadable', copyKept: false },
    'Your saved fit checks could not be read, so the page started without them. A copy could not be kept, and the unreadable data will be replaced the next time you save. Run Check my fit again to rebuild them.',
  ],
  [
    'resume newer',
    { store: 'resume', kind: 'newer', copyKept: false },
    'Your saved resume was written by a newer version of this app, so the page started without it. A copy could not be kept, and that data will be replaced the next time you save. Add your resume again to continue.',
  ],
  [
    'fit checks newer',
    { store: 'analyses', kind: 'newer', copyKept: false },
    'Your saved fit checks were written by a newer version of this app, so the page started without them. A copy could not be kept, and that data will be replaced the next time you save. Run Check my fit again to rebuild them.',
  ],
  [
    'some fit checks dropped, one',
    { store: 'analyses', kind: 'partial', copyKept: false, dropped: 1 },
    '1 saved fit check could not be read and was left out. The others are fine. A copy could not be kept.',
  ],
  [
    'some fit checks dropped, three',
    { store: 'analyses', kind: 'partial', copyKept: false, dropped: 3 },
    '3 saved fit checks could not be read and were left out. The others are fine. A copy could not be kept.',
  ],
]

test.each(NOT_KEPT)('copy could not be kept: %s', (_name, partial, expected) => {
  const line = incidentLine(incident(partial))

  expect(line).toBe(expected)
  expect(line).not.toContain('A copy is kept in this browser.')
})
