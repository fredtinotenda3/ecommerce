// tests/fakes/FakeAuthUserRepository.ts
import type {
  AuthUserRecord,
  AuthUserRepository,
  CreateAuthUserInput,
} from '../../src/lib/repositories/AuthUserRepository'
import type { Role } from '../../src/lib/domain/types'

let idCounter = 0
const nextId = (): string => `user_${++idCounter}`

export class FakeAuthUserRepository implements AuthUserRepository {
  private usersById = new Map<string, AuthUserRecord>()

  /** Test helper — seeds a user with an already-computed hash/salt, e.g.
   * to simulate an "existing Payload user" the native service must be
   * able to verify without any password reset. */
  seed(user: Partial<AuthUserRecord> & { email: string }): AuthUserRecord {
    const record: AuthUserRecord = {
      id: user.id ?? nextId(),
      email: user.email.toLowerCase(),
      name: user.name ?? null,
      roles: user.roles ?? (['customer'] as Role[]),
      hash: user.hash ?? null,
      salt: user.salt ?? null,
      loginAttempts: user.loginAttempts ?? 0,
      lockUntil: user.lockUntil ?? null,
      resetPasswordToken: user.resetPasswordToken ?? null,
      resetPasswordExpiration: user.resetPasswordExpiration ?? null,
      createdAt: user.createdAt ?? new Date(),
      updatedAt: user.updatedAt ?? new Date(),
    }
    this.usersById.set(record.id, record)
    return record
  }

  async getByEmail(email: string): Promise<AuthUserRecord | null> {
    const lower = email.toLowerCase()
    return Array.from(this.usersById.values()).find(u => u.email === lower) ?? null
  }

  async getById(id: string): Promise<AuthUserRecord | null> {
    return this.usersById.get(id) ?? null
  }

  async getByResetToken(token: string): Promise<AuthUserRecord | null> {
    const now = Date.now()
    return (
      Array.from(this.usersById.values()).find(
        u =>
          u.resetPasswordToken === token &&
          u.resetPasswordExpiration &&
          u.resetPasswordExpiration.getTime() > now,
      ) ?? null
    )
  }

  async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    const record: AuthUserRecord = {
      id: nextId(),
      email: input.email.toLowerCase(),
      name: input.name ?? null,
      roles: input.roles?.length ? input.roles : (['customer'] as Role[]),
      hash: input.hash,
      salt: input.salt,
      loginAttempts: 0,
      lockUntil: null,
      resetPasswordToken: null,
      resetPasswordExpiration: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.usersById.set(record.id, record)
    return record
  }

  async updatePasswordHash(id: string, hash: string, salt: string): Promise<void> {
    const user = this.usersById.get(id)
    if (!user) return
    user.hash = hash
    user.salt = salt
    user.loginAttempts = 0
    user.lockUntil = null
    user.updatedAt = new Date()
  }

  async setResetToken(id: string, token: string, expiresAt: Date): Promise<void> {
    const user = this.usersById.get(id)
    if (!user) return
    user.resetPasswordToken = token
    user.resetPasswordExpiration = expiresAt
  }

  async invalidateResetToken(id: string): Promise<void> {
    const user = this.usersById.get(id)
    if (!user) return
    user.resetPasswordExpiration = new Date()
  }

  async recordFailedLogin(id: string, maxAttempts: number, lockTimeMs: number): Promise<void> {
    const user = this.usersById.get(id)
    if (!user) return
    user.loginAttempts = (user.loginAttempts ?? 0) + 1
    if (user.loginAttempts >= maxAttempts) {
      user.lockUntil = new Date(Date.now() + lockTimeMs)
    }
  }

  async resetLoginAttempts(id: string): Promise<void> {
    const user = this.usersById.get(id)
    if (!user) return
    user.loginAttempts = 0
    user.lockUntil = null
  }
}
