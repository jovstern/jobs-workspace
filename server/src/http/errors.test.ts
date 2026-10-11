import { readdirSync, readFileSync } from 'node:fs'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { apiErrorSchema } from '@jobs-workspace/shared'
import express from 'express'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createApp } from '../app'
import { errorHandler, notFoundHandler } from './errors'

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
