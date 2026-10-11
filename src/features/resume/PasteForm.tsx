import {
  canonicaliseResumeText,
  redactContactDetails,
  resumeTextSchema,
} from '@jobs-workspace/shared'
import type { RedactionCounts } from '@jobs-workspace/shared'
import { useForm } from '@tanstack/react-form'
import { useId, useState } from 'react'
import { z } from 'zod'

import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import { buildResumeRecord, useResumeStore } from './resume-store'

const pasteSchema = z.object({ text: resumeTextSchema })

interface PasteFormProps {
  onSaved?: () => void
}

type Stage = 'draft' | 'reviewed'

const NOTHING_FOUND =
  'We did not find an email address, phone number, street address or link to remove. Check the text below for anything else you want to remove.'

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`
}

// Only the kinds that were found, in the order of the placeholder note.
function describeRemoved(counts: RedactionCounts): string {
  return [
    counts.email > 0 ? plural(counts.email, 'email address', 'email addresses') : null,
    counts.phone > 0 ? plural(counts.phone, 'phone number', 'phone numbers') : null,
    counts.address > 0 ? plural(counts.address, 'street address', 'street addresses') : null,
    counts.link > 0 ? plural(counts.link, 'link', 'links') : null,
  ]
    .filter((item) => item !== null)
    .join(', ')
}

function removedAnything(counts: RedactionCounts): boolean {
  return counts.email + counts.phone + counts.address + counts.link > 0
}

// The paste step of resume intake and the reference form for the project: TanStack Form with a Zod
// schema as the validator. First submit removes contact details and shows the result and what was
// removed; the text stays editable. Saving runs the removal again, so a detail typed back in is
// caught, and only a pass that removes nothing is saved.
export function PasteForm({ onSaved }: PasteFormProps) {
  const fieldId = useId()
  const saveResume = useResumeStore((state) => state.saveResume)
  const [stage, setStage] = useState<Stage>('draft')
  const [counts, setCounts] = useState<RedactionCounts | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { text: '' },
    validators: { onSubmit: pasteSchema },
    onSubmit: async ({ value, formApi }) => {
      const cleaned = redactContactDetails(canonicaliseResumeText(value.text))
      if (stage === 'draft' || removedAnything(cleaned.counts)) {
        formApi.setFieldValue('text', cleaned.text)
        setCounts(cleaned.counts)
        setStage('reviewed')
        return
      }
      try {
        const { record } = await buildResumeRecord(value.text, new Date().toISOString())
        saveResume(record)
        onSaved?.()
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'This text cannot be saved.')
      }
    },
  })

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="text">
        {(field) => {
          const error = field.state.meta.errors[0]?.message ?? saveError ?? undefined
          const errorId = `${fieldId}-error`
          return (
            <div className="flex flex-col gap-1">
              <label htmlFor={fieldId} className="text-sm font-semibold">
                Paste your resume text
              </label>
              <textarea
                id={fieldId}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  setSaveError(null)
                  field.handleChange(event.target.value)
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="max-h-96 min-h-64 w-full resize-y rounded border border-gray-300 bg-white px-4 py-2 font-mono text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              />
              {error ? (
                <p id={errorId} role="alert" className="text-sm text-red-800">
                  {error}
                </p>
              ) : null}
            </div>
          )
        }}
      </form.Field>

      {counts !== null ? (
        <>
          <Notice tone="neutral" role="status">
            <p>
              {removedAnything(counts)
                ? `Removed before anything is sent to Google: ${describeRemoved(counts)}. Your name is kept. This catches common formats only. Check the text below for anything else you want to remove.`
                : NOTHING_FOUND}
            </p>
          </Notice>
          <p className="text-sm text-gray-600">
            Removed details appear as [email removed], [phone removed], [address removed] and [link
            removed].
          </p>
        </>
      ) : null}

      <div>
        <Button type="submit" variant="primary">
          {stage === 'draft' ? 'Review text' : 'Save resume'}
        </Button>
      </div>
    </form>
  )
}
