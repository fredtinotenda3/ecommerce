// src/app/_api/auth.ts
//
// DB-wired entry points for the authentication service. `AuthService.ts`
// takes repository INTERFACES so it can be unit tested without a database;
// this file supplies the concrete `MongoAuthUserRepository` bound to the
// real connection for route handlers to call.
//
// Reads and writes, all scoped to the `users` collection's auth fields —
// see AuthUserRepository.ts for why writes here can never touch cart,
// purchases or order data.

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

export const registerUser = async (
  input: AuthService.RegisterInput,
): Promise<AuthService.RegisterResult> => {
  const userRepository = await getUserRepository()
  return AuthService.register(input, { userRepository })
}

export const loginUser = async (
  input: AuthService.LoginInput,
): Promise<AuthService.LoginResult> => {
  const userRepository = await getUserRepository()
  return AuthService.login(input, { userRepository })
}

export const logoutUser = async (): Promise<{ success: true }> => {
  return AuthService.logout()
}

export const getCurrentUser = async (
  token: string | null | undefined,
): Promise<AuthService.SanitizedAuthUser> => {
  const userRepository = await getUserRepository()
  return AuthService.getCurrentUser(token, { userRepository })
}

export const requestPasswordReset = async (
  email: string,
): Promise<AuthService.ForgotPasswordResult> => {
  const userRepository = await getUserRepository()
  return AuthService.requestPasswordReset(email, { userRepository })
}

export const resetPasswordForToken = async (
  input: AuthService.ResetPasswordInput,
): Promise<AuthService.LoginResult> => {
  const userRepository = await getUserRepository()
  return AuthService.resetPassword(input, { userRepository })
}
