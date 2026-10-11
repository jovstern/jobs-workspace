import type { ReactNode } from 'react'

interface CardProps {
  as?: 'section' | 'div'
  labelledBy?: string
  children: ReactNode
}

// The one white surface. Phase 2 restyles it here and nowhere else.
export function Card({ as = 'section', labelledBy, children }: CardProps) {
  const Element = as
  return (
    <Element
      aria-labelledby={labelledBy}
      className="min-w-0 rounded-lg border border-gray-200 bg-white p-6"
    >
      {children}
    </Element>
  )
}
