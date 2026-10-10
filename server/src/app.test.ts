import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createApp, healthResponseSchema } from './app'

let server: Server
let baseUrl: string

beforeAll(async () => {
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${String(port)}`
})

afterAll(() => {
  server.close()
})

test('GET /api/health reports ok', async () => {
  const response = await fetch(`${baseUrl}/api/health`)

  expect(response.status).toBe(200)
  expect(healthResponseSchema.parse(await response.json())).toEqual({ status: 'ok' })
})

test('unknown routes return 404', async () => {
  const response = await fetch(`${baseUrl}/api/nope`)

  expect(response.status).toBe(404)
})
