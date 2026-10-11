import { useId, useState } from 'react'

import { Card } from '../../components/Card'
import { PasteForm } from './PasteForm'
import { PrivacyNote } from './PrivacyNote'
import { useResumeStore } from './resume-store'

const HEADING = 'text-xl leading-[1.2] font-semibold text-gray-900'

// Two states: no resume (the paste form) and saved (a one-line summary). Replace and delete are
// Phase 01.2. The hidden status region is always rendered so a screen reader hears the change
// when it is filled after a save.
export function ResumeCard() {
  const headingId = useId()
  const resume = useResumeStore((state) => state.resume)
  const [justSaved, setJustSaved] = useState(false)

  return (
    <Card labelledBy={headingId}>
      <h2 id={headingId} className={HEADING}>
        Your resume
      </h2>
      <p role="status" className="sr-only">
        {justSaved ? 'Resume saved.' : ''}
      </p>
      {resume === null ? (
        <>
          <p className="mt-4 text-base font-semibold text-gray-900">No resume yet</p>
          <p className="mt-1 text-base text-gray-600">Add your resume to check your fit.</p>
          <div className="mt-4">
            <PasteForm
              onSaved={() => {
                setJustSaved(true)
              }}
            />
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-gray-600 tabular-nums">
          Resume saved. {resume.text.length} characters.
        </p>
      )}
      <div className="mt-6 border-t border-gray-200 pt-6">
        <PrivacyNote />
      </div>
    </Card>
  )
}
