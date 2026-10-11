import { fitResponseSchema } from '@jobs-workspace/shared'
import { useMutation, useMutationState } from '@tanstack/react-query'

import { apiRequest } from '../../lib/api'
import { useFitStore } from './fit-store'

const FIT_MUTATION_KEY = ['fit']

export interface CheckFitVariables {
  jobId: string
  resumeText: string
  resumeHash: string
}

function isCheckFitVariables(value: unknown): value is CheckFitVariables {
  return typeof value === 'object' && value !== null && 'jobId' in value
}

// A paid call: it starts only from a click handler and is never retried or resumed by itself.
// `retry: false` stops a repeat after a failure; `networkMode: 'always'` stops TanStack Query
// from pausing the call while offline and firing it later when the connection returns.
export function useCheckFit() {
  const saveAnalysis = useFitStore((state) => state.saveAnalysis)

  return useMutation({
    mutationKey: FIT_MUTATION_KEY,
    retry: false,
    networkMode: 'always',
    mutationFn: (variables: CheckFitVariables) =>
      apiRequest({
        path: '/api/fit',
        method: 'POST',
        body: { jobId: variables.jobId, resumeText: variables.resumeText },
        schema: fitResponseSchema,
      }),
    // Hook level on purpose: this still runs if the component unmounts before the answer comes.
    // The resume hash comes from the variables captured at click time, not from current state.
    onSuccess: (data, variables) => {
      saveAnalysis({ ...data, resumeHash: variables.resumeHash })
    },
  })
}

// True while a check for this job is in flight, so a second click cannot start a second request.
export function useIsCheckingFit(jobId: string): boolean {
  const pendingJobIds = useMutationState({
    filters: { mutationKey: FIT_MUTATION_KEY, status: 'pending' },
    select: (mutation) =>
      isCheckFitVariables(mutation.state.variables) ? mutation.state.variables.jobId : null,
  })
  return pendingJobIds.includes(jobId)
}
