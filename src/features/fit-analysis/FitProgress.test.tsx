import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { FitProgress } from './FitProgress'
import { FIT_REASSURANCE, progressLine } from './progress-lines'

const READING = 'Reading your resume'
const COMPARING = 'Comparing it with each requirement'
const WRITING = 'Writing your learning plan and tips'
const SLOW = 'Still working. This can take up to a minute.'

test.each([
  [0, READING],
  [3, READING],
  [4, COMPARING],
  [9, COMPARING],
  [10, WRITING],
  [29, WRITING],
  [30, SLOW],
  [120, SLOW],
  [-5, READING],
  [Number.NaN, READING],
])('progressLine(%s) is "%s"', (elapsed, line) => {
  expect(progressLine(elapsed)).toBe(line)
})

test('the stage lines never contain a digit', () => {
  for (const elapsed of [0, 4, 10, 30, 120]) {
    expect(progressLine(elapsed)).not.toMatch(/\d/)
  }
})

test('the reassurance sentence is the one the contract fixes', () => {
  expect(FIT_REASSURANCE).toBe('Usually 10 to 20 seconds.')
})

function tick(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

test('the stage line moves at 4, 10 and 30 seconds of elapsed time', () => {
  const { container } = render(<FitProgress />)
  const line = () => container.textContent

  expect(line()).toBe(READING)
  tick(3000)
  expect(line()).toBe(READING)
  tick(1000)
  expect(line()).toBe(COMPARING)
  tick(5000)
  expect(line()).toBe(COMPARING)
  tick(1000)
  expect(line()).toBe(WRITING)
  tick(19000)
  expect(line()).toBe(WRITING)
  tick(1000)
  expect(line()).toBe(SLOW)
})

test('between stage changes nothing in the document changes and the paragraph is the same element', () => {
  const { container } = render(<FitProgress />)
  tick(4000)
  const paragraph = screen.getByText(COMPARING)

  const observer = new MutationObserver(() => undefined)
  observer.observe(container, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  })
  for (let second = 5; second <= 9; second += 1) tick(1000)
  const records = observer.takeRecords()
  observer.disconnect()

  expect(records).toHaveLength(0)
  expect(screen.getByText(COMPARING)).toBe(paragraph)

  tick(1000)
  expect(screen.getByText(WRITING)).toBe(paragraph)
})

test('the elapsed time is never shown as a number', () => {
  const { container } = render(<FitProgress />)
  for (let second = 0; second < 40; second += 1) {
    tick(1000)
    expect(container.textContent).not.toMatch(/\d/)
  }
})

test('unmounting leaves no timer running', () => {
  const { unmount } = render(<FitProgress />)
  expect(vi.getTimerCount()).toBeGreaterThan(0)

  unmount()

  expect(vi.getTimerCount()).toBe(0)
})
