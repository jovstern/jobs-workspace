import { ApiError } from '@google/genai'
import { describe, expect, test } from 'vitest'

import { diagnoseError, FAILURE_CATEGORIES } from './diagnose'

function apiError(status: number, message: string): ApiError {
  return new ApiError({ status, message })
}

describe('diagnoseError', () => {
  test.each([
    [400, 'INVALID_ARGUMENT'],
    [401, 'UNAUTHENTICATED'],
    [403, 'PERMISSION_DENIED'],
    [404, 'NOT_FOUND'],
    [429, 'RESOURCE_EXHAUSTED'],
    [500, 'INTERNAL'],
    [503, 'UNAVAILABLE'],
    [504, 'DEADLINE_EXCEEDED'],
  ])('HTTP %i from the provider is %s', (status, category) => {
    expect(diagnoseError(apiError(status, 'x'))).toEqual({ httpStatus: status, category })
  })

  test('a 400 that Google labels FAILED_PRECONDITION keeps that label', () => {
    const error = apiError(400, '{"error":{"code":400,"status":"FAILED_PRECONDITION"}}')
    expect(diagnoseError(error)).toEqual({ httpStatus: 400, category: 'FAILED_PRECONDITION' })
  })

  test('an unmapped HTTP status keeps the number and a generic category', () => {
    expect(diagnoseError(apiError(418, 'x'))).toEqual({ httpStatus: 418, category: 'unknown' })
  })

  test('failures that are not HTTP answers have no status and a fixed category', () => {
    const abort = new DOMException('The operation was aborted', 'AbortError')
    const timeout = new DOMException('The operation timed out', 'TimeoutError')
    expect(diagnoseError(abort)).toEqual({ httpStatus: null, category: 'aborted' })
    expect(diagnoseError(timeout)).toEqual({ httpStatus: null, category: 'timeout' })
    expect(diagnoseError(new TypeError('fetch failed'))).toEqual({
      httpStatus: null,
      category: 'network',
    })
    expect(diagnoseError(new SyntaxError('Unexpected token'))).toEqual({
      httpStatus: null,
      category: 'invalid_json',
    })
    expect(diagnoseError(new Error('anything'))).toEqual({ httpStatus: null, category: 'unknown' })
    expect(diagnoseError('a string')).toEqual({ httpStatus: null, category: 'unknown' })
    expect(diagnoseError(undefined)).toEqual({ httpStatus: null, category: 'unknown' })
  })

  test('a diagnostic can never carry message text, whatever the message holds', () => {
    const secrets = [
      'Senior Frontend Engineer at Northwind Labs, 9 years of React',
      'AIzaSyFAKE-KEY-0123456789',
      'You are a careful recruiter. Rate each requirement.',
      '{"error":{"code":400,"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT"}}',
    ]
    for (const secret of secrets) {
      const errors = [
        apiError(400, secret),
        apiError(429, secret),
        apiError(418, secret),
        new TypeError(secret),
        new SyntaxError(secret),
        new Error(secret),
        Object.assign(new Error(secret), { status: 400 }),
        secret,
      ]
      for (const error of errors) {
        const diagnostic = diagnoseError(error)
        const text = JSON.stringify(diagnostic)
        expect(Object.keys(diagnostic).sort()).toEqual(['category', 'httpStatus'])
        expect(FAILURE_CATEGORIES).toContain(diagnostic.category)
        expect(diagnostic.httpStatus === null || Number.isInteger(diagnostic.httpStatus)).toBe(true)
        expect(text).not.toContain(secret)
        expect(text).not.toContain('Northwind')
        expect(text).not.toContain('AIza')
        expect(text).not.toContain('recruiter')
      }
    }
  })

  test('a status outside the HTTP range is ignored', () => {
    expect(diagnoseError(Object.assign(new Error('x'), { status: 99999 }))).toEqual({
      httpStatus: null,
      category: 'unknown',
    })
  })
})
