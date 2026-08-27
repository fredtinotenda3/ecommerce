// tests/payloadCompatiblePassword.test.ts
import { describe, expect, it } from 'vitest'
import {
  hashPasswordPayloadCompatible,
  MIN_NATIVE_PASSWORD_LENGTH,
  verifyPasswordPayloadCompatible,
} from '../src/lib/auth/password'

// This fixed { password, salt, hash } vector was computed independently
// with Node's raw `crypto.pbkdf2` (25000 iterations, 512-byte key,
// sha256 — the exact parameters Payload 2.0.7 uses, verified by reading
// node_modules/payload/dist/auth/strategies/local/generatePasswordSaltHash.js
// directly), NOT with this codebase's own hashing function. It stands in
// for a hash/salt pair that already exists in the `users` collection
// from a real Payload-created account, so this test proves
// `verifyPasswordPayloadCompatible` can authenticate an EXISTING Payload
// user without any password reset — the core Phase 5 compatibility
// requirement.
const EXISTING_PAYLOAD_USER = {
  password: 'existing-payload-user-pw',
  salt: 'deadbeefcafebabe0011223344556677',
  hash:
    '406bc18da521e9c501115acaec4b3ee9c9d115b38907a1a187262e25ee06974ccb7c1c3a4417aaf92a1e644f5b9996d' +
    '2dfb1f4df6ddc83d9bfc45fef68b1ac5747acd75563b91d160ac3ba954eea9b96830b3ebcbcec7465af39dc7c88c924d' +
    '0337b2a269665aaf543b59756d821f9cdafdd531af5d540ef1f7b76f863757042c4927d21559ee021ba003dd7a0b5366' +
    '3b00961544671296fad5af4987b432e64836db3e0e532247c96cb1c2a959403e8e7ac04a55b241be196221b78b9beb4b' +
    'a4562c1804c5c8d266035a4ccda9e2c926fbed2954586b99c003c6c4a85a118813a97cbbc4cf627d02a146473471bcb3' +
    'e7267be9bd51a2d5cbfac74e66d02d7adeb2710c9384d9f349a9b80282990bc486901973e32fa49cd45688c68b9ceefb' +
    'ec6e27320b1620ed7398d13e36061fb75929be304083cced227b6c7579cfe2c032583c934f8598110f762e5f7cfd7cfa' +
    '0dc6e46346b968d0e208affe35392eb3103919cbc7658f5d48e24219ef16511bb8df0a1ecb52f467702947a594d59ab1' +
    'b9ea48da22f6004e263ff0aa42bbde3e9da9b16cacf89d82de949050f2eee6a041192d4656f6955e237b5c0d9cf7ce58' +
    '568d1753af6df2b9548528b3a43cf03e83a00ada9427d4ae1ff02864113678a925ec5785b9722b0251486c33eb481dae' +
    'bb0f9ab183fc0a450fe486f5ddfe8c43c725219b6138b28abbee72f5d3b429d02',
}

describe('verifyPasswordPayloadCompatible', () => {
  it('verifies a password against a hash/salt pair produced by Payload\'s own algorithm', async () => {
    const isValid = await verifyPasswordPayloadCompatible(
      EXISTING_PAYLOAD_USER.password,
      EXISTING_PAYLOAD_USER.hash,
      EXISTING_PAYLOAD_USER.salt,
    )
    expect(isValid).toBe(true)
  })

  it('rejects the wrong password against that same existing hash/salt', async () => {
    const isValid = await verifyPasswordPayloadCompatible(
      'wrong-password',
      EXISTING_PAYLOAD_USER.hash,
      EXISTING_PAYLOAD_USER.salt,
    )
    expect(isValid).toBe(false)
  })

  it('returns false (never throws) for missing hash/salt', async () => {
    expect(await verifyPasswordPayloadCompatible('anything', null, null)).toBe(false)
    expect(await verifyPasswordPayloadCompatible('anything', undefined, undefined)).toBe(false)
    expect(await verifyPasswordPayloadCompatible('anything', 'somehash', undefined)).toBe(false)
  })

  it('returns false (never throws) for a malformed non-hex hash', async () => {
    expect(
      await verifyPasswordPayloadCompatible('anything', 'not-valid-hex!!', EXISTING_PAYLOAD_USER.salt),
    ).toBe(false)
  })
})

describe('hashPasswordPayloadCompatible', () => {
  it('produces a hash/salt pair that verifies successfully via verifyPasswordPayloadCompatible', async () => {
    const { hash, salt } = await hashPasswordPayloadCompatible('a-brand-new-password')
    expect(await verifyPasswordPayloadCompatible('a-brand-new-password', hash, salt)).toBe(true)
  })

  it('produces a different salt (and thus hash) each time', async () => {
    const a = await hashPasswordPayloadCompatible('same-password-123')
    const b = await hashPasswordPayloadCompatible('same-password-123')
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
  })

  it('produces a 32-byte (64 hex char) salt and 512-byte (1024 hex char) hash, matching Payload exactly', async () => {
    const { hash, salt } = await hashPasswordPayloadCompatible('length-check-password')
    expect(salt).toHaveLength(64)
    expect(hash).toHaveLength(1024)
  })
})

describe('MIN_NATIVE_PASSWORD_LENGTH', () => {
  it('is a stricter policy than Payload\'s own 3-character minimum', () => {
    expect(MIN_NATIVE_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8)
  })
})
