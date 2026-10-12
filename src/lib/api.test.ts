import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Mock } from 'vitest'
import { z } from 'zod'

import { ApiError, DEFAULT_TIMEOUT_MS, apiRequest } from './api'

const schema = z.object({ ok: z.literal(true) })

let fetchMock: Mock<typeof fetch>

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function answer(body: string, status: number, contentType: string) {
  fetchMock.mockResolvedValue(
    new Response(body, { status, headers: { 'content-type': contentType } }),
  )
}

async function failure(): Promise<ApiError> {
  try {
    await apiRequest({ path: '/api/x', schema })
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('The request was expected to fail')
}

test('the default browser timeout is 60 seconds', () => {
  expect(DEFAULT_TIMEOUT_MS).toBe(60000)
})

test('a request that rejects with a network error is server_unreachable and retryable', async () => {
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

  const error = await failure()

  expect(error.code).toBe('server_unreachable')
  expect(error.retryable).toBe(true)
  expect(error.message).toBe("Can't reach the app server (is it running?)")
})

test('a request that rejects with a TimeoutError is request_timeout and retryable', async () => {
  fetchMock.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'))

  const error = await failure()

  expect(error.code).toBe('request_timeout')
  expect(error.retryable).toBe(true)
  expect(error.message).toBe('The request took too long. Try again.')
})

test('a non-ok response with a valid envelope throws the envelope code and flag unchanged', async () => {
  answer(
    JSON.stringify({ error: { code: 'ai_blocked', message: 'Server wording.', retryable: false } }),
    422,
    'application/json',
  )

  const error = await failure()

  expect(error.code).toBe('ai_blocked')
  expect(error.retryable).toBe(false)
})

test('an empty 502 from the proxy is server_unreachable', async () => {
  answer('', 502, 'text/plain')

  const error = await failure()

  expect(error.code).toBe('server_unreachable')
  expect(error.retryable).toBe(true)
})

test('a 500 with an HTML body is server_unreachable', async () => {
  answer('<html><body>Bad gateway</body></html>', 500, 'text/html')

  expect((await failure()).code).toBe('server_unreachable')
})

test('a 503 with JSON that is not an envelope is server_unreachable', async () => {
  answer(JSON.stringify({ status: 'down' }), 503, 'application/json')

  expect((await failure()).code).toBe('server_unreachable')
})

test('a 502 whose JSON has a code and a message but no retryable flag is server_unreachable', async () => {
  answer(JSON.stringify({ error: { code: 'ai_failed', message: 'x' } }), 502, 'application/json')

  const error = await failure()

  expect(error.code).toBe('server_unreachable')
  expect(error.retryable).toBe(true)
})

test('a 404 with no envelope is internal_error and retryable', async () => {
  answer('Not found', 404, 'text/plain')

  const error = await failure()

  expect(error.code).toBe('internal_error')
  expect(error.retryable).toBe(true)
})

test('an ok response whose body fails the schema is internal_error', async () => {
  answer(JSON.stringify({ ok: false }), 200, 'application/json')

  const error = await failure()

  expect(error.code).toBe('internal_error')
  expect(error.retryable).toBe(true)
})

test('an ok response that matches the schema is returned', async () => {
  answer(JSON.stringify({ ok: true }), 200, 'application/json')

  await expect(apiRequest({ path: '/api/x', schema })).resolves.toEqual({ ok: true })
})
