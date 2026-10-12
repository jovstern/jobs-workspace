import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

import { useStorageIncidents } from '../../lib/storage-incidents'
import { StorageNotice } from './StorageNotice'

beforeEach(() => {
  useStorageIncidents.getState().dismissAll()
})

test('renders nothing when there is no incident', () => {
  const { container } = render(<StorageNotice />)

  expect(container).toBeEmptyDOMElement()
})

test('shows one line per incident inside one alert', () => {
  render(<StorageNotice />)

  act(() => {
    useStorageIncidents.getState().report({ store: 'analyses', kind: 'unreadable', copyKept: true })
  })

  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent(
    'Your saved fit checks could not be read, so they were set aside. Run Check my fit again to rebuild them. A copy is kept in this browser.',
  )
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
})

test('Dismiss empties the list and calls onDismiss', async () => {
  const onDismiss = vi.fn()
  render(<StorageNotice onDismiss={onDismiss} />)
  act(() => {
    useStorageIncidents.getState().report({ store: 'analyses', kind: 'unreadable', copyKept: true })
  })

  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

  expect(useStorageIncidents.getState().incidents).toEqual([])
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(onDismiss).toHaveBeenCalledTimes(1)
})

test('has no button other than Dismiss', () => {
  render(<StorageNotice />)
  act(() => {
    useStorageIncidents.getState().report({ store: 'analyses', kind: 'unreadable', copyKept: true })
  })

  expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Dismiss'])
})

test('three incidents render three lines in report order with one Dismiss button', () => {
  render(<StorageNotice />)
  act(() => {
    const { report } = useStorageIncidents.getState()
    report({ store: 'resume', kind: 'unreadable', copyKept: true })
    report({ store: 'analyses', kind: 'partial', copyKept: true, dropped: 1 })
    report({ store: 'analyses', kind: 'write_failed', copyKept: false })
  })

  const lines = screen.getAllByRole('listitem').map((item) => item.textContent)
  expect(lines[0]).toMatch(/^Your saved resume could not be read/)
  expect(lines[1]).toMatch(/^1 saved fit check could not be read/)
  expect(lines[2]).toMatch(/^Your browser could not save/)
  expect(screen.getAllByRole('button')).toHaveLength(1)
})

test('the notice never offers or mentions download, restore, export or erase', () => {
  render(<StorageNotice />)
  act(() => {
    const { report } = useStorageIncidents.getState()
    for (const store of ['resume', 'analyses'] as const) {
      for (const kind of ['unreadable', 'newer', 'partial', 'write_failed'] as const) {
        for (const copyKept of [true, false]) {
          report({ store, kind, copyKept, dropped: 2 })
        }
      }
    }
  })

  expect(screen.getByRole('alert').textContent).not.toMatch(/download|restore|export|erase/i)
})
