// src/lib/auth/password.ts
//
// Password hashing and verification.
//
// The PBKDF2 pair (`hashPasswordPayloadCompatible` /
// `verifyPasswordPayloadCompatible`) is what the auth service uses. Its
// parameters — 25,000 iterations, 512-byte derived key, sha256, a random
// 32-byte hex salt, and `hash`/`salt` stored as two separate fields —
// match exactly what the previous CMS wrote, which is why accounts created
// before the migration still verify against their original passwords. Do
// not change these parameters without a migration path that rehashes on
// next successful login; changing them alone locks every existing user out.
// Verification is constant-time.
//
// The scrypt pair (`hashPassword`/`verifyPassword`) is a stronger scheme
// kept for future use. It is not wired into any route: switching to it
// requires the rehash-on-login step described above.

import {
  pbkdf2 as pbkdf2Callback,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(scryptCallback)
const pbkdf2 = promisify(pbkdf2Callback)

const KEY_LENGTH = 64
const SALT_LENGTH = 16

// --- Payload-compatible PBKDF2 (see header comment) ---
// These constants mirror Payload 2.0.7's local auth strategy exactly, so
// hashes produced/verified here are byte-for-byte interchangeable with
// what Payload itself writes to the `hash`/`salt` fields on `users`.
const PBKDF2_SALT_BYTES = 32
const PBKDF2_ITERATIONS = 25000
const PBKDF2_KEY_LENGTH = 512
const PBKDF2_DIGEST = 'sha256'

export interface PayloadCompatibleHash {
  hash: string
  salt: string
}

/** Payload's own default password rule (see
 * generatePasswordSaltHash.js's `defaultPasswordValidator`) only requires
 * 3+ characters. The native register endpoint enforces a stronger 8+
 * character minimum as a deliberate policy choice — see the Phase 5
 * report's "areas where native auth deliberately differs from Payload"
 * section. This does not affect verifying EXISTING Payload users, whose
 * passwords may be as short as 3 characters and must still verify. */
export const MIN_NATIVE_PASSWORD_LENGTH = 8

/** Hashes a plaintext password into the exact `{ hash, salt }` shape
 * Payload stores on a user document. Used both for native registration
 * (so the resulting user can also log in through Payload's own
 * `/api/users/login` and admin UI) and for native password resets. */
export const hashPasswordPayloadCompatible = async (
  plainPassword: string,
): Promise<PayloadCompatibleHash> => {
  const saltBuffer = randomBytes(PBKDF2_SALT_BYTES)
  const salt = saltBuffer.toString('hex')
  const hashBuffer = (await pbkdf2(
    plainPassword,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    PBKDF2_DIGEST,
  )) as Buffer
  return { hash: hashBuffer.toString('hex'), salt }
}

/** Verifies a plaintext password against the `hash`/`salt` pair already
 * stored on an existing Payload (or native-created) user document. This
 * is what makes existing users' passwords verifiable without any reset —
 * the whole point of Phase 5's compatibility requirement. */
export const verifyPasswordPayloadCompatible = async (
  plainPassword: string,
  hash: string | null | undefined,
  salt: string | null | undefined,
): Promise<boolean> => {
  if (typeof hash !== 'string' || typeof salt !== 'string' || !hash || !salt) {
    return false
  }
  try {
    const derivedKey = (await pbkdf2(
      plainPassword,
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEY_LENGTH,
      PBKDF2_DIGEST,
    )) as Buffer
    const storedKey = Buffer.from(hash, 'hex')
    if (storedKey.length !== derivedKey.length) {
      return false
    }
    return timingSafeEqual(derivedKey, storedKey)
  } catch {
    // Malformed stored hash/salt (e.g. non-hex) — never throw, just fail
    // the verification, matching verifyPassword's existing behavior below.
    return false
  }
}

/** Returns a single string encoding both the salt and derived key, e.g.
 * `"<hex salt>:<hex hash>"`, so callers only need to persist one field. */
export const hashPassword = async (plainPassword: string): Promise<string> => {
  if (plainPassword.length < 8) {
    throw new Error('hashPassword: password must be at least 8 characters')
  }
  const salt = randomBytes(SALT_LENGTH).toString('hex')
  const derivedKey = (await scrypt(plainPassword, salt, KEY_LENGTH)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

export const verifyPassword = async (
  plainPassword: string,
  storedHash: string,
): Promise<boolean> => {
  const [salt, keyHex] = storedHash.split(':')
  if (!salt || !keyHex) {
    return false
  }
  const derivedKey = (await scrypt(plainPassword, salt, KEY_LENGTH)) as Buffer
  const storedKey = Buffer.from(keyHex, 'hex')

  // Guard against timingSafeEqual throwing on mismatched lengths, and
  // against leaking length information via the exception path either.
  if (storedKey.length !== derivedKey.length) {
    return false
  }
  return timingSafeEqual(derivedKey, storedKey)
}
