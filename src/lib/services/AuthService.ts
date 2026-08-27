// src/lib/services/AuthService.ts
//
// PHASE 5 — native authentication service. Orchestration only (mirrors
// the fetchXNative.ts / buildStorefrontX split from Phases 2-4): this
// file takes an `AuthUserRepository` INTERFACE, not a concrete Mongo
// class, so it's unit-testable with a fake repository and no database
// (see tests/fakes/FakeAuthUserRepository.ts). DB wiring lives in
// src/app/_api/authNative.ts, and cookie/HTTP concerns live in the
// src/app/api/auth-native/*/route.ts handlers.
//
// NOT wired into the live login/registration/logout UX. Payload's own
// `/api/users/*` auth remains the only auth path the frontend calls —
// see src/app/_providers/Auth/index.tsx, which is unmodified. This
// service exists so a future, separately-approved phase can switch the
// frontend to call these endpoints instead.
//
// Compatibility: passwords are hashed/verified via
// `hashPasswordPayloadCompatible` / `verifyPasswordPayloadCompatible`
// (src/lib/auth/password.ts), which reproduce Payload's own PBKDF2
// scheme exactly. This means:
//   - An EXISTING Payload user (created via the storefront's
//     create-account page, or the admin UI) can log in here without any
//     password reset.
//   - A user registered here can also log in through Payload's own
//     `/api/users/login` and the Payload admin UI, since the `hash`/
//     `salt` fields this writes are indistinguishable from what Payload
//     itself would have written.

import { randomBytes } from 'crypto'

import {
  hashPasswordPayloadCompatible,
  MIN_NATIVE_PASSWORD_LENGTH,
  verifyPasswordPayloadCompatible,
} from '../auth/password'
import { createSessionToken, verifySessionToken } from '../auth/session'
import type { Role } from '../domain/types'
import type { AuthUserRecord, AuthUserRepository } from '../repositories/AuthUserRepository'

// Mirrors Payload's own defaults (see
// node_modules/payload/dist/collections/config/defaults.js:
// `maxLoginAttempts: 5, lockTime: 600000`), used only for the NATIVE
// session's own lockout bookkeeping. This is deliberately a parallel,
// independent counter from Payload's — see the Phase 5 report's
// "deliberately differs" section for why the two are not shared.
export const MAX_LOGIN_ATTEMPTS = 5
export const LOCK_TIME_MS = 600_000 // 10 minutes

// Mirrors Payload's own forgotPassword.js: 1 hour expiration, a 20-byte
// random hex token.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000
const RESET_TOKEN_BYTES = 20

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'EMAIL_TAKEN'
  | 'WEAK_PASSWORD'
  | 'INVALID_TOKEN'
  | 'UNAUTHENTICATED'

export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode, message: string) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

/** Never includes `hash`/`salt`/reset-token fields — this is the only
 * shape route handlers should ever serialize into a JSON response. */
export interface SanitizedAuthUser {
  id: string
  email: string
  name: string | null
  roles: Role[]
}

export interface AuthSession {
  token: string
  expiresAt: number
}

const sanitize = (user: AuthUserRecord): SanitizedAuthUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  roles: user.roles,
})

const issueSession = (user: AuthUserRecord): AuthSession => {
  const token = createSessionToken({ userId: user.id, roles: user.roles })
  const payload = verifySessionToken(token)
  return { token, expiresAt: payload.expiresAt }
}

export interface RegisterInput {
  email: string
  password: string
  name?: string | null
}

export interface RegisterResult {
  user: SanitizedAuthUser
  session: AuthSession
}

/** Registers a new user directly into the existing `users` collection
 * with a Payload-compatible password hash, then immediately issues a
 * native session (mirroring Payload's own `loginAfterCreate` hook,
 * which logs a user in immediately after `/api/users` create). */
export const register = async (
  input: RegisterInput,
  deps: { userRepository: AuthUserRepository },
): Promise<RegisterResult> => {
  const email = input.email.trim().toLowerCase()

  if (!input.password || input.password.length < MIN_NATIVE_PASSWORD_LENGTH) {
    throw new AuthError(
      'WEAK_PASSWORD',
      `Password must be at least ${MIN_NATIVE_PASSWORD_LENGTH} characters`,
    )
  }

  const existing = await deps.userRepository.getByEmail(email)
  if (existing) {
    throw new AuthError('EMAIL_TAKEN', 'An account with that email already exists')
  }

  const { hash, salt } = await hashPasswordPayloadCompatible(input.password)
  const created = await deps.userRepository.createUser({
    email,
    name: input.name ?? null,
    hash,
    salt,
    roles: ['customer'],
  })

  return { user: sanitize(created), session: issueSession(created) }
}

export interface LoginInput {
  email: string
  password: string
}

export interface LoginResult {
  user: SanitizedAuthUser
  session: AuthSession
}

/** Verifies email/password against whatever hash is already stored on
 * the user document — whether that user was created by Payload or by
 * `register` above, the verification path is identical. */
export const login = async (
  input: LoginInput,
  deps: { userRepository: AuthUserRepository },
): Promise<LoginResult> => {
  const email = input.email.trim().toLowerCase()
  const user = await deps.userRepository.getByEmail(email)

  // Same generic error whether the account doesn't exist or the password
  // is wrong — never reveal which, mirroring Payload's own opaque
  // "invalid credentials" behavior.
  const invalid = (): AuthError => new AuthError('INVALID_CREDENTIALS', 'Invalid email or password')

  if (!user) {
    throw invalid()
  }

  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    throw new AuthError('ACCOUNT_LOCKED', 'Account is temporarily locked due to failed logins')
  }

  const isValid = await verifyPasswordPayloadCompatible(input.password, user.hash, user.salt)
  if (!isValid) {
    await deps.userRepository.recordFailedLogin(user.id, MAX_LOGIN_ATTEMPTS, LOCK_TIME_MS)
    throw invalid()
  }

  if (user.loginAttempts > 0 || user.lockUntil) {
    await deps.userRepository.resetLoginAttempts(user.id)
  }

  return { user: sanitize(user), session: issueSession(user) }
}

/** Verifies a native session token and loads the current user. Throws
 * `UNAUTHENTICATED` for any invalid/expired/missing token, or if the
 * user the token refers to no longer exists. */
export const getCurrentUser = async (
  token: string | null | undefined,
  deps: { userRepository: AuthUserRepository },
): Promise<SanitizedAuthUser> => {
  if (!token) {
    throw new AuthError('UNAUTHENTICATED', 'No session token provided')
  }
  let payload
  try {
    payload = verifySessionToken(token)
  } catch {
    throw new AuthError('UNAUTHENTICATED', 'Invalid or expired session token')
  }
  const user = await deps.userRepository.getById(payload.userId)
  if (!user) {
    throw new AuthError('UNAUTHENTICATED', 'Session refers to a user that no longer exists')
  }
  return sanitize(user)
}

/** Requires the current session's user to have at least one of the
 * given roles. Mirrors src/lib/auth/roles.ts's `assertHasRole`, exposed
 * here as an `AuthError` (not a plain `Error`) so route handlers can map
 * it to a 403 consistently with the rest of this service's errors. */
export const requireRole = (user: SanitizedAuthUser, allowed: Role[]): void => {
  if (!allowed.some(role => user.roles.includes(role))) {
    throw new AuthError('UNAUTHENTICATED', `Requires one of role(s): ${allowed.join(', ')}`)
  }
}

/** Native sessions are stateless HMAC tokens (see src/lib/auth/session.ts)
 * with no server-side revocation store in this phase — see the Phase 5
 * report's "Remaining Risks" for this known limitation, same as any
 * stateless-JWT scheme without a blocklist. "Logout" is therefore purely
 * a client/cookie-clearing concern; this function exists so the route
 * handler has something explicit to call rather than being a no-op, and
 * as the natural extension point if a revocation store is added later. */
export const logout = async (): Promise<{ success: true }> => {
  return { success: true }
}

export interface ForgotPasswordResult {
  /** Only ever populated for tests / internal callers that already have
   * repository access — route handlers must NOT include this in the
   * HTTP response (no email delivery is wired up in this phase; see the
   * Phase 5 report). Whether or not the email exists, the route handler
   * should return the same generic success response either way. */
  token?: string
  userFound: boolean
}

/** Generates and stores a reset token in the exact shape/expiration
 * Payload's own forgotPassword.js uses, so a follow-up phase could wire
 * real email delivery without changing this function. Never throws for
 * an unknown email — the caller (route handler) is responsible for
 * returning an identical response regardless, to avoid leaking account
 * existence. */
export const requestPasswordReset = async (
  email: string,
  deps: { userRepository: AuthUserRepository },
): Promise<ForgotPasswordResult> => {
  const user = await deps.userRepository.getByEmail(email.trim().toLowerCase())
  if (!user) {
    return { userFound: false }
  }
  const token = randomBytes(RESET_TOKEN_BYTES).toString('hex')
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)
  await deps.userRepository.setResetToken(user.id, token, expiresAt)
  return { token, userFound: true }
}

export interface ResetPasswordInput {
  token: string
  newPassword: string
}

/** Validates the reset token (must exist and not be expired — enforced
 * by `AuthUserRepository.getByResetToken`'s query, mirroring Payload's
 * `resetPasswordExpiration: { greater_than: new Date() }` check),
 * writes a new Payload-compatible hash, invalidates the token, and
 * immediately issues a new session (matching Payload's own
 * resetPassword.js, which also logs the user in on success). */
export const resetPassword = async (
  input: ResetPasswordInput,
  deps: { userRepository: AuthUserRepository },
): Promise<LoginResult> => {
  if (!input.newPassword || input.newPassword.length < MIN_NATIVE_PASSWORD_LENGTH) {
    throw new AuthError(
      'WEAK_PASSWORD',
      `Password must be at least ${MIN_NATIVE_PASSWORD_LENGTH} characters`,
    )
  }

  const user = await deps.userRepository.getByResetToken(input.token)
  if (!user) {
    throw new AuthError('INVALID_TOKEN', 'Token is either invalid or has expired')
  }

  const { hash, salt } = await hashPasswordPayloadCompatible(input.newPassword)
  await deps.userRepository.updatePasswordHash(user.id, hash, salt)
  await deps.userRepository.invalidateResetToken(user.id)

  const refreshed = await deps.userRepository.getById(user.id)
  // Practically unreachable (we just wrote to this exact user), but keeps
  // the function's return type honest without a non-null assertion.
  if (!refreshed) {
    throw new AuthError('INVALID_TOKEN', 'User was removed during password reset')
  }

  return { user: sanitize(refreshed), session: issueSession(refreshed) }
}
