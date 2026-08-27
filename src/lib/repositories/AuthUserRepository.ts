// src/lib/repositories/AuthUserRepository.ts
//
// PHASE 5 — flag-gated, native authentication data access.
//
// Deliberately a SEPARATE repository from `UserRepository`
// (UserRepository.ts), not an extension of it. `UserRepository`'s
// `toDomain` mapping is used by cart/checkout/purchase code throughout
// the app and intentionally never exposes password/auth-internal fields
// (`hash`, `salt`, `loginAttempts`, `lockUntil`, `resetPasswordToken`,
// `resetPasswordExpiration`). Folding auth fields into that shared
// interface would mean every existing caller of `UserRepository` could
// now accidentally end up holding password hashes in memory. Keeping
// auth reads/writes in their own narrowly-scoped repository is safer and
// leaves `UserRepository`/`MongoUserRepository` completely untouched.
//
// This performs the READS AND WRITES native auth actually needs
// (register/login/reset-password require writes, unlike the read-only
// storefront repositories from Phases 2-4). All writes here are scoped
// to auth fields only — never `cart`, `purchases`, `stripeCustomerID`,
// or anything Stripe/checkout/order-related.

import type { Connection } from 'mongoose'

import { getUserModel, type UserDocument } from '../db/models/User'
import type { Role } from '../domain/types'

export interface AuthUserRecord {
  id: string
  email: string
  name: string | null
  roles: Role[]
  hash: string | null
  salt: string | null
  loginAttempts: number
  lockUntil: Date | null
  resetPasswordToken: string | null
  resetPasswordExpiration: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateAuthUserInput {
  email: string
  name?: string | null
  hash: string
  salt: string
  roles?: Role[]
}

export interface AuthUserRepository {
  getByEmail(email: string): Promise<AuthUserRecord | null>
  getById(id: string): Promise<AuthUserRecord | null>
  getByResetToken(token: string): Promise<AuthUserRecord | null>
  createUser(input: CreateAuthUserInput): Promise<AuthUserRecord>
  updatePasswordHash(id: string, hash: string, salt: string): Promise<void>
  setResetToken(id: string, token: string, expiresAt: Date): Promise<void>
  /** Mirrors Payload's own resetPassword.js: after a successful reset,
   * the expiration is set to "now" (rather than deleting the token),
   * which is sufficient to invalidate it against the
   * `resetPasswordExpiration > now` check `getByResetToken` uses. */
  invalidateResetToken(id: string): Promise<void>
  recordFailedLogin(id: string, maxAttempts: number, lockTimeMs: number): Promise<void>
  resetLoginAttempts(id: string): Promise<void>
}

const toAuthRecord = (doc: UserDocument): AuthUserRecord => ({
  id: doc._id.toString(),
  email: doc.email,
  name: doc.name ?? null,
  roles: (doc.roles?.length ? doc.roles : ['customer']) as Role[],
  hash: doc.hash ?? null,
  salt: doc.salt ?? null,
  loginAttempts: doc.loginAttempts ?? 0,
  lockUntil: doc.lockUntil ?? null,
  resetPasswordToken: doc.resetPasswordToken ?? null,
  resetPasswordExpiration: doc.resetPasswordExpiration ?? null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
})

export class MongoAuthUserRepository implements AuthUserRepository {
  private readonly connection: Connection

  constructor(connection: Connection) {
    this.connection = connection
  }

  async getByEmail(email: string): Promise<AuthUserRecord | null> {
    const Model = getUserModel(this.connection)
    const doc = await Model.findOne({ email: email.toLowerCase() }).lean<UserDocument>().exec()
    return doc ? toAuthRecord(doc as unknown as UserDocument) : null
  }

  async getById(id: string): Promise<AuthUserRecord | null> {
    const Model = getUserModel(this.connection)
    const doc = await Model.findById(id).lean<UserDocument>().exec()
    return doc ? toAuthRecord(doc as unknown as UserDocument) : null
  }

  async getByResetToken(token: string): Promise<AuthUserRecord | null> {
    const Model = getUserModel(this.connection)
    const doc = await Model.findOne({
      resetPasswordToken: token,
      resetPasswordExpiration: { $gt: new Date() },
    })
      .lean<UserDocument>()
      .exec()
    return doc ? toAuthRecord(doc as unknown as UserDocument) : null
  }

  async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    const Model = getUserModel(this.connection)
    const doc = await Model.create({
      email: input.email.toLowerCase(),
      name: input.name ?? undefined,
      hash: input.hash,
      salt: input.salt,
      roles: input.roles?.length ? input.roles : ['customer'],
      loginAttempts: 0,
    })
    return toAuthRecord(doc.toObject() as UserDocument)
  }

  async updatePasswordHash(id: string, hash: string, salt: string): Promise<void> {
    const Model = getUserModel(this.connection)
    await Model.updateOne(
      { _id: id },
      { $set: { hash, salt, loginAttempts: 0 }, $unset: { lockUntil: '' } },
    ).exec()
  }

  async setResetToken(id: string, token: string, expiresAt: Date): Promise<void> {
    const Model = getUserModel(this.connection)
    await Model.updateOne(
      { _id: id },
      { $set: { resetPasswordToken: token, resetPasswordExpiration: expiresAt } },
    ).exec()
  }

  async invalidateResetToken(id: string): Promise<void> {
    const Model = getUserModel(this.connection)
    await Model.updateOne({ _id: id }, { $set: { resetPasswordExpiration: new Date() } }).exec()
  }

  async recordFailedLogin(id: string, maxAttempts: number, lockTimeMs: number): Promise<void> {
    const Model = getUserModel(this.connection)
    const doc = await Model.findById(id).select('loginAttempts').lean<UserDocument>().exec()
    const nextAttempts = (doc?.loginAttempts ?? 0) + 1
    const update: Record<string, unknown> = { loginAttempts: nextAttempts }
    if (nextAttempts >= maxAttempts) {
      update.lockUntil = new Date(Date.now() + lockTimeMs)
    }
    await Model.updateOne({ _id: id }, { $set: update }).exec()
  }

  async resetLoginAttempts(id: string): Promise<void> {
    const Model = getUserModel(this.connection)
    await Model.updateOne(
      { _id: id },
      { $set: { loginAttempts: 0 }, $unset: { lockUntil: '' } },
    ).exec()
  }
}
