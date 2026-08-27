// src/app/_api/authNative.ts
//
// PHASE 5 — DB-wired entry points for the native auth service. Mirrors
// the fetchProductNative.ts / fetchPageNative.ts split: `AuthService.ts`
// takes repository INTERFACES for unit testing, and this file supplies
// the concrete `MongoAuthUserRepository` wired to the real DB connection
// for actual route handlers to call.
//
// This performs READS AND WRITES (register/login/reset-password), all
// scoped to the `users` collection's existing auth fields only — see
// AuthUserRepository.ts's header comment for why writes here can never
// touch cart/purchases/Stripe fields.

import { getDbConnection } from '../../lib/db/connection'
import {
  type AuthUserRepository,
  MongoAuthUserRepository,
} from '../../lib/repositories/AuthUserRepository'
import * as AuthService from '../../lib/services/AuthService'

const getUserRepository = async (): Promise<AuthUserRepository> => {
  const connection = await getDbConnection()
  return new MongoAuthUserRepository(connection)
}

export const registerNative = async (
  input: AuthService.RegisterInput,
): Promise<AuthService.RegisterResult> => {
  const userRepository = await getUserRepository()
  return AuthService.register(input, { userRepository })
}

export const loginNative = async (
  input: AuthService.LoginInput,
): Promise<AuthService.LoginResult> => {
  const userRepository = await getUserRepository()
  return AuthService.login(input, { userRepository })
}

export const logoutNative = async (): Promise<{ success: true }> => {
  return AuthService.logout()
}

export const getCurrentUserNative = async (
  token: string | null | undefined,
): Promise<AuthService.SanitizedAuthUser> => {
  const userRepository = await getUserRepository()
  return AuthService.getCurrentUser(token, { userRepository })
}

export const requestPasswordResetNative = async (
  email: string,
): Promise<AuthService.ForgotPasswordResult> => {
  const userRepository = await getUserRepository()
  return AuthService.requestPasswordReset(email, { userRepository })
}

export const resetPasswordNative = async (
  input: AuthService.ResetPasswordInput,
): Promise<AuthService.LoginResult> => {
  const userRepository = await getUserRepository()
  return AuthService.resetPassword(input, { userRepository })
}
