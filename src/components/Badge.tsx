import type { ReactNode } from 'react'

export type BadgeTone = 'success' | 'teal' | 'caution' | 'neutral' | 'danger'

interface BadgeProps {
  tone: BadgeTone
  children: ReactNode
}

const TONES: Record<BadgeTone, string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  teal: 'border-teal-200 bg-teal-50 text-teal-800',
  caution: 'border-amber-200 bg-amber-50 text-amber-900',
  neutral: 'border-gray-200 bg-gray-100 text-gray-800',
  danger: 'border-red-200 bg-red-50 text-red-800',
}

// A short status label. Colour is never the only signal: the words carry the meaning, and
// glyphs placed inside are decoration for the caller to hide from assistive technology.
export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}
