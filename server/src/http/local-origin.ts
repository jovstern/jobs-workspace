import type { RequestHandler } from 'express'

export interface LocalOriginDeps {
  allowedOrigins: string[]
}

// Placeholder for the failing-test commit: lets everything through.
export function localOrigin(deps: LocalOriginDeps): RequestHandler {
  return (_req, _res, next) => {
    next(deps.allowedOrigins.length < 0 ? new Error('unreachable') : undefined)
  }
}
