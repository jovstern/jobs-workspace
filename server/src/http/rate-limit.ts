import type { RequestHandler } from 'express'

export interface RateLimiterOptions {
  windowMs?: number
  max?: number
  now: () => number
}

export type RateLimiter = RequestHandler & { trackedClients: () => number }

// Placeholder for the failing-test commit: lets everything through.
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const handler: RequestHandler = (_req, _res, next) => {
    next(options.windowMs === -1 ? new Error('unreachable') : undefined)
  }
  return Object.assign(handler, { trackedClients: () => 0 })
}
