import type { LearningPlan } from '@jobs-workspace/shared'
import { useId } from 'react'

interface LearningPlanBlockProps {
  plan: LearningPlan
  // A partly evidenced requirement: the plan covers only the missing part.
  partial: boolean
}

// Everything from the model (steps, why it matters) is rendered as plain text, never as markup.
export function LearningPlanBlock({ plan, partial }: LearningPlanBlockProps) {
  const stepsLabelId = useId()

  return (
    <div className="flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-4">
      {partial ? (
        <p className="text-sm text-gray-600">
          This plan covers only what your resume does not yet show.
        </p>
      ) : null}
      <p id={stepsLabelId} className="text-sm font-semibold text-gray-900">
        What to learn
      </p>
      <ol
        aria-labelledby={stepsLabelId}
        className="flex list-decimal flex-col gap-1 pl-6 text-sm break-words text-gray-900"
      >
        {plan.steps.map((step, index) => (
          // Steps are plain strings in a fixed order that never reorders; two may read the same.
          <li key={`${String(index)}:${step}`}>{step}</li>
        ))}
      </ol>
      <p className="text-sm font-semibold text-gray-900">Why it matters for this job</p>
      <p className="text-sm break-words text-gray-900">{plan.whyItMatters}</p>
      <p className="text-sm text-gray-900">
        <span className="font-semibold">Rough effort:</span> {plan.effort}
      </p>
    </div>
  )
}
