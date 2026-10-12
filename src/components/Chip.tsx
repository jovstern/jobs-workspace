import type { ReactNode } from 'react'

interface ChipProps {
  children: ReactNode
}

// A short read-only label, used for keywords. It is deliberately not a control: no role, no
// handler, no tab stop, never a link. The remove button and the other variants arrive in Phase 01.2.
export function Chip({ children }: ChipProps) {
  return (
    <span className="rounded-full border border-gray-300 bg-white px-2 py-1 text-sm break-words text-gray-900">
      {children}
    </span>
  )
}
