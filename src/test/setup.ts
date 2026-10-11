import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // Store tests share browser storage, so no test sees what an earlier one saved.
  localStorage.clear()
})
