import { expect, test } from 'vitest'

import { sha256Hex } from './sha256'

test('hashes a known string to its published SHA-256 digest', async () => {
  expect(await sha256Hex('abc')).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
})

test('returns 64 lower-case hex characters for text outside ASCII', async () => {
  expect(await sha256Hex('Zoë 日本語 🚀')).toMatch(/^[0-9a-f]{64}$/)
})

test('gives the same hash for the same text and a different hash for different text', async () => {
  expect(await sha256Hex('same')).toBe(await sha256Hex('same'))
  expect(await sha256Hex('one')).not.toBe(await sha256Hex('two'))
})
