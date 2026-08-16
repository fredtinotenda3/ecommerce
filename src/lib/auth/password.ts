// src/lib/auth/password.ts
//
// Foundation only — NOT wired into any route in this phase. Payload's
// own authentication continues to be the live auth system (see the
// Phase 1 brief's explicit instruction not to replace auth yet).
//
// Uses Node's built-in `crypto.scrypt`, deliberately avoiding a new
// runtime dependency (bcrypt/argon2) for this foundational phase. This
// can be swapped for bcrypt/argon2 later without changing the exported
// function signatures, if that's preferred once native auth is actually
// activated — scrypt is a legitimate, well-reviewed choice either way
// (it's what Node's own docs recommend for password hashing use cases).

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(scryptCallback)

const KEY_LENGTH = 64
const SALT_LENGTH = 16

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
