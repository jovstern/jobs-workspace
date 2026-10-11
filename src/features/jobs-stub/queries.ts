import { healthResponseSchema, jobsResponseSchema } from '@jobs-workspace/shared'
import { queryOptions } from '@tanstack/react-query'

import { apiRequest } from '../../lib/api'

export const jobsQueryOptions = queryOptions({
  queryKey: ['jobs'],
  queryFn: () => apiRequest({ path: '/api/jobs', schema: jobsResponseSchema }),
})

// The AI status the page shows before the user tries a fit check. A free, local request: it never
// calls Google.
export const healthQueryOptions = queryOptions({
  queryKey: ['health'],
  queryFn: () => apiRequest({ path: '/api/health', schema: healthResponseSchema }),
})
