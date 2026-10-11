import { request } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { apiErrorSchema } from '@jobs-workspace/shared'
import express from 'express'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { errorHandler, notFoundHandler } from './errors'
import { localOrigin } from './local-origin'

const ALLOWED = 'http://localhost:5173'

let server: Server
let port: number

beforeAll(async () => {
  const app = express()
  app.use(localOrigin({ allowedOrigins: [ALLOWED] }))
  app.get('/ping', (_req, res) => {
    res.json({ ok: true })
  })
  app.post('/ping', (_req, res) => {
    res.json({ ok: true })
  })
  app.use(notFoundHandler)
  app.use(errorHandler)
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  port = (server.address() as AddressInfo).port
})

afterAll(() => {
  server.close()
})

interface Result {
  status: number
  headers: Record<string, string | string[] | undefined>
  text: string
}

// node:http, not fetch, so a test can set the Host header and the browser-only headers.
function send(
  method: 'GET' | 'POST',
  headers: Record<string, string> = {},
  body?: string,
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path: '/ping',
        method,
        headers: { host: `localhost:${String(port)}`, ...headers },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            text: Buffer.concat(chunks).toString('utf8'),
          })
        })
      },
    )
    req.on('error', reject)
    req.end(body)
  })
}

function errorCode(result: Result): string {
  return apiErrorSchema.parse(JSON.parse(result.text)).error.code
}

const JSON_HEADERS = { 'content-type': 'application/json' }

describe('Host header', () => {
  test.each(['localhost', 'localhost:3001', '127.0.0.1:3001', '[::1]:3001', '[::1]'])(
    'accepts the loopback name %s',
    async (host) => {
      const result = await send('GET', { host })

      expect(result.status).toBe(200)
    },
  )

  test.each(['evil.example', 'evil.example:3001', 'localhost.evil.example', '192.168.1.20:3001'])(
    'refuses %s with 403 forbidden_origin',
    async (host) => {
      const result = await send('GET', { host })

      expect(result.status).toBe(403)
      expect(errorCode(result)).toBe('forbidden_origin')
    },
  )
})

describe('Origin header', () => {
  test('refuses an origin that is not in the allow-list with 403 forbidden_origin', async () => {
    const result = await send('POST', { ...JSON_HEADERS, origin: 'https://evil.example' }, '{}')

    expect(result.status).toBe(403)
    expect(errorCode(result)).toBe('forbidden_origin')
  })

  test('refuses an origin that only starts like an allowed one', async () => {
    const result = await send('GET', { origin: `${ALLOWED}.evil.example` })

    expect(result.status).toBe(403)
  })

  test('lets an allowed origin through', async () => {
    const result = await send('POST', { ...JSON_HEADERS, origin: ALLOWED }, '{}')

    expect(result.status).toBe(200)
  })

  test('lets a request with no Origin header through', async () => {
    const result = await send('POST', JSON_HEADERS, '{}')

    expect(result.status).toBe(200)
  })
})

describe('Sec-Fetch-Site header', () => {
  test('refuses cross-site with 403 forbidden_origin', async () => {
    const result = await send('POST', { ...JSON_HEADERS, 'sec-fetch-site': 'cross-site' }, '{}')

    expect(result.status).toBe(403)
    expect(errorCode(result)).toBe('forbidden_origin')
  })

  test.each(['same-origin', 'same-site', 'none'])('lets %s through', async (value) => {
    const result = await send('GET', { 'sec-fetch-site': value })

    expect(result.status).toBe(200)
  })
})

describe('content type of a POST', () => {
  test.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x'])(
    'refuses %s with 415 unsupported_media_type',
    async (contentType) => {
      const result = await send('POST', { 'content-type': contentType }, 'a=b')

      expect(result.status).toBe(415)
      expect(errorCode(result)).toBe('unsupported_media_type')
    },
  )

  test('refuses a POST with no content type', async () => {
    const result = await send('POST', {}, '{}')

    expect(result.status).toBe(415)
  })

  test('accepts application/json with a charset', async () => {
    const result = await send('POST', { 'content-type': 'application/json; charset=utf-8' }, '{}')

    expect(result.status).toBe(200)
  })

  test('does not apply the content-type rule to GET', async () => {
    const result = await send('GET', { 'content-type': 'text/plain' })

    expect(result.status).toBe(200)
  })
})

test('never sends an Access-Control-Allow-Origin header', async () => {
  const allowed = await send('GET', { origin: ALLOWED })
  const refused = await send('GET', { origin: 'https://evil.example' })

  expect(allowed.status).toBe(200)
  expect(refused.status).toBe(403)
  expect(allowed.headers['access-control-allow-origin']).toBeUndefined()
  expect(refused.headers['access-control-allow-origin']).toBeUndefined()
})
