import { readdirSync, readFileSync } from 'node:fs'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  apiErrorSchema,
  ERROR_CODES,
  ERROR_MESSAGES,
  GENERIC_NOT_RETRYABLE_MESSAGE,
  type ErrorCode,
} from '@jobs-workspace/shared'
import express from 'express'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createApp } from '../app'
import { AppError, errorHandler, notFoundHandler } from './errors'

// The status and the retry flag of every code, written out so a change to either is deliberate.
const EXPECTED: Record<ErrorCode, { status: number; retryable: boolean }> = {
  ai_not_configured: { status: 503, retryable: false },
  ai_auth_failed: { status: 502, retryable: false },
  ai_billing: { status: 502, retryable: false },
  ai_rate_limited: { status: 429, retryable: true },
  ai_overloaded: { status: 502, retryable: true },
  ai_timeout: { status: 504, retryable: true },
  ai_network: { status: 502, retryable: true },
  ai_blocked: { status: 422, retryable: false },
  ai_truncated: { status: 502, retryable: true },
  ai_invalid_output: { status: 502, retryable: true },
  ai_failed: { status: 502, retryable: true },
  validation_error: { status: 400, retryable: false },
  not_found: { status: 404, retryable: false },
  too_many_requests: { status: 429, retryable: true },
  forbidden_origin: { status: 403, retryable: false },
  unsupported_media_type: { status: 415, retryable: false },
  payload_too_large: { status: 413, retryable: false },
  internal_error: { status: 500, retryable: true },
}

let server: Server
let url: string

async function listen(app: express.Express): Promise<Server> {
  const listening = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => listening.once('listening', resolve))
  return listening
}

beforeAll(async () => {
  const app = express()
  app.get('/boom', () => {
    throw new Error('secret detail')
  })
  app.use(notFoundHandler)
  app.use(errorHandler)
  server = await listen(app)
  url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
})

afterAll(() => {
  server.close()
})

describe('error bodies', () => {
  test('an unexpected error answers 500 internal_error and never echoes the thrown text', async () => {
    const response = await fetch(`${url}/boom`)
    const text = await response.text()

    expect(response.status).toBe(500)
    const body = apiErrorSchema.parse(JSON.parse(text))
    expect(body.error.code).toBe('internal_error')
    expect(body.error.message).toBe('Something went wrong on our side. Try again.')
    expect(text).not.toContain('secret detail')
  })

  test('an unknown route answers 404 not_found with the not-retryable sentence', async () => {
    const response = await fetch(`${url}/nowhere`)

    expect(response.status).toBe(404)
    const { error } = apiErrorSchema.parse(await response.json())
    expect(error.code).toBe('not_found')
    expect(error.message).toBe(GENERIC_NOT_RETRYABLE_MESSAGE)
    expect(error.retryable).toBe(false)
  })
})

describe('AppError', () => {
  test('the table above names every code', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...ERROR_CODES].sort())
  })

  test.each(ERROR_CODES)('%s has its status, retry flag and the fixed sentence', (code) => {
    const error = new AppError(code)

    expect(error.status).toBe(EXPECTED[code].status)
    expect(error.retryable).toBe(EXPECTED[code].retryable)
    expect(error.message).toBe(ERROR_MESSAGES[code])
  })
})

describe('request body limits on the fit route', () => {
  let appServer: Server
  let appUrl: string

  beforeAll(async () => {
    appServer = await listen(createApp({ ai: null, log: () => undefined }))
    appUrl = `http://127.0.0.1:${String((appServer.address() as AddressInfo).port)}`
  })

  afterAll(() => {
    appServer.close()
  })

  async function postRaw(body: string): Promise<{ status: number; text: string }> {
    const response = await fetch(`${appUrl}/api/fit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
    return { status: response.status, text: await response.text() }
  }

  test('a JSON body over 256 kB answers 413 payload_too_large', async () => {
    const { status, text } = await postRaw(
      JSON.stringify({ jobId: 'job-frontend-senior', resumeText: 'x'.repeat(300 * 1024) }),
    )

    expect(status).toBe(413)
    expect(apiErrorSchema.parse(JSON.parse(text)).error.code).toBe('payload_too_large')
  })

  test('malformed JSON answers 400 validation_error', async () => {
    const { status, text } = await postRaw('{"jobId": ')

    expect(status).toBe(400)
    expect(apiErrorSchema.parse(JSON.parse(text)).error.code).toBe('validation_error')
    expect(text).not.toContain('Unexpected')
  })
})

// The server is stateless (DATA-06): no source module may write a file. Tests, scripts and
// test support are the only places allowed to.
describe('statelessness', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url))
  const WRITE_APIS = ['writeFile', 'appendFile', 'createWriteStream']

  function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        return entry.name === 'scripts' || entry.name === 'test-support' ? [] : sourceFiles(path)
      }
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
    })
  }

  test('no source module calls a file-writing API', () => {
    const files = sourceFiles(SRC)
    expect(files.length).toBeGreaterThan(5)
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const api of WRITE_APIS) {
        expect(source, `${file} mentions ${api}`).not.toContain(api)
      }
    }
  })
})
