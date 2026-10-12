import { beforeEach, expect, test } from 'vitest'

import { useStorageIncidents } from './storage-incidents'

beforeEach(() => {
  useStorageIncidents.getState().dismissAll()
})

test('starts with no incident', () => {
  expect(useStorageIncidents.getState().incidents).toEqual([])
})

test('report appends an incident with its own id, in report order', () => {
  const { report } = useStorageIncidents.getState()

  report({ store: 'resume', kind: 'unreadable', copyKept: true })
  report({ store: 'analyses', kind: 'partial', copyKept: true, dropped: 2 })

  const incidents = useStorageIncidents.getState().incidents
  expect(incidents.map((incident) => incident.store)).toEqual(['resume', 'analyses'])
  expect(incidents[0]?.id).not.toBe(incidents[1]?.id)
  expect(incidents[1]?.dropped).toBe(2)
})

test('a second write_failed for the same store adds no second line, another store does', () => {
  const { report } = useStorageIncidents.getState()

  report({ store: 'analyses', kind: 'write_failed', copyKept: false })
  report({ store: 'analyses', kind: 'write_failed', copyKept: false })
  expect(useStorageIncidents.getState().incidents).toHaveLength(1)

  report({ store: 'resume', kind: 'write_failed', copyKept: false })
  expect(useStorageIncidents.getState().incidents).toHaveLength(2)
})

test('dismissAll empties the list, and a later write_failed is accepted again', () => {
  const { report, dismissAll } = useStorageIncidents.getState()
  report({ store: 'analyses', kind: 'write_failed', copyKept: false })

  dismissAll()
  expect(useStorageIncidents.getState().incidents).toEqual([])

  report({ store: 'analyses', kind: 'write_failed', copyKept: false })
  expect(useStorageIncidents.getState().incidents).toHaveLength(1)
})
