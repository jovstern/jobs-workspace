import type { ReactNode } from 'react'

type NoticeTone = 'neutral' | 'caution' | 'danger'

interface NoticeProps {
  tone: NoticeTone
  role: 'status' | 'alert'
  heading?: string
  children: ReactNode
}

const TONES: Record<NoticeTone, string> = {
  neutral: 'border-gray-200 bg-gray-100 text-gray-800',
  caution: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-800',
}

// Colour is never the only signal: every notice carries words. Danger is for errors only.
export function Notice({ tone, role, heading, children }: NoticeProps) {
  return (
    <div role={role} className={`rounded-lg border p-4 ${TONES[tone]}`}>
      {heading !== undefined ? <p className="text-base font-semibold">{heading}</p> : null}
      <div className="flex flex-col items-start gap-2 text-base break-words">{children}</div>
    </div>
  )
}
