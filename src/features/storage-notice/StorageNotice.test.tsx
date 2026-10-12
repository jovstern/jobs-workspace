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
