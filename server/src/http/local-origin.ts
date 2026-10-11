import type { RequestHandler } from 'express'

import { AppError } from './errors'

export interface LocalOriginDeps {
  allowedOrigins: string[]
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// `localhost:3001` -> `localhost`, `[::1]:3001` -> `[::1]`.
function hostName(host: string): string {
  const value = host.trim().toLowerCase()
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    return end === -1 ? value : value.slice(0, end + 1)
  }
  return value.split(':')[0] ?? ''
}

function mediaType(contentType: string | undefined): string {
  return (contentType?.split(';')[0] ?? '').trim().toLowerCase()
}

// Keeps other web pages from using this loopback API, and so from spending the AI key. It sets
// no response header at all: there is no CORS here, because the page reaches the API through the
// dev proxy on its own origin, and a page on another origin is stopped by its browser's
// preflight as well as by these checks. Each check throws, so the central handler shapes the answer.
export function localOrigin({ allowedOrigins }: LocalOriginDeps): RequestHandler {
  return (req, _res, next) => {
    // DNS rebinding: a hostile name that resolves to 127.0.0.1 still carries its own Host.
    if (!LOOPBACK_HOSTS.has(hostName(req.headers.host ?? ''))) {
      throw new AppError('forbidden_origin')
    }

    // Exact string match; a missing Origin means a same-origin or non-browser caller.
    const origin = req.headers.origin
    if (origin !== undefined && !allowedOrigins.includes(origin)) {
      throw new AppError('forbidden_origin')
    }

    if (req.headers['sec-fetch-site'] === 'cross-site') {
      throw new AppError('forbidden_origin')
    }

    // A form or text/plain POST is a "simple" cross-site request that skips the preflight.
    if (
      !SAFE_METHODS.has(req.method) &&
      mediaType(req.headers['content-type']) !== 'application/json'
    ) {
      throw new AppError('unsupported_media_type')
    }

    next()
  }
}
