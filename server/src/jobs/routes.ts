import { Router } from 'express'

import type { JobsResponse } from '@jobs-workspace/shared'

import { listJobs } from './seed'

export function createJobsRouter() {
  const router = Router()

  router.get('/', (_req, res) => {
    const body: JobsResponse = { jobs: listJobs() }
    res.json(body)
  })

  return router
}
