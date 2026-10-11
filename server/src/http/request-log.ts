import type { RequestHandler } from 'express'

export interface RequestLogDeps {
  log: (line: string) => void
  now: () => number
}

// One line per request: method, path, status and duration. It never looks at the request body,
// the headers or anything the handler sent, so a resume or a model answer cannot end up in a log.
export function requestLog({ log, now }: RequestLogDeps): RequestHandler {
  return (req, res, next) => {
    const startedAt = now()
    // `path` of the original URL, without the query string.
    const path = req.originalUrl.split('?')[0] ?? ''
    res.on('finish', () => {
      log(`${req.method} ${path} ${String(res.statusCode)} ${String(now() - startedAt)}ms`)
    })
    next()
  }
}
