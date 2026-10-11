import { jobsResponseSchema } from '@jobs-workspace/shared'
import { queryOptions } from '@tanstack/react-query'

import { apiRequest } from '../../lib/api'

export const jobsQueryOptions = queryOptions({
  queryKey: ['jobs'],
  queryFn: () => apiRequest({ path: '/api/jobs', schema: jobsResponseSchema }),
})
