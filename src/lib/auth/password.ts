// src/lib/auth/password.ts
//
// PHASE 1 (scrypt pair below) — Foundation only, not wired into any
// route. Kept as-is; nothing in Phase 5 uses it, and its own tests
// (tests/auth.test.ts) still pass unchanged.
//
// PHASE 5 (PBKDF2 pair further down) — this is what the native auth
// service actually uses. The Phase 1 comment above assumed Payload used
// bcrypt-style hashing and that scrypt could be swapped in for
// bcrypt/argon2 later. That assumption was WRONG: inspecting Payload
// 2.0.7's actual auth strategy
// (node_modules/payload/dist/auth/strategies/local/{authenticate,generatePasswordSaltHash}.js)
// shows Payload uses Node's built-in `crypto.pbkdf2` — NOT bcrypt — with:
//   - 25000 iterations
//   - 512-byte derived key length
//   - sha256 digest
//   - a random 32-byte salt (hex-encoded)
//   - hash and salt stored as two SEPARATE fields (`hash`, `salt`) on the
//     user document, not one combined string
//   - constant-time comparison via the `scmp` package
// Since this is already Node's built-in `crypto` module, NO new
// dependency (bcrypt/bcryptjs/argon2) is needed or was added — see the
// Phase 5 report for the explicit "no new dependency" confirmation.
// The scrypt pair below is left untouched (different algorithm, single
// combined-string format) since nothing depends on it being
// Payload-compatible and removing it would be a gratuitous change.

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
