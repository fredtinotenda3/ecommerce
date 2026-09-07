// tests/fakes/FakeUserRepository.ts
//
// In-memory `UserRepository` (the storefront-safe one, NOT
// `AuthUserRepository`) for unit tests that need customer/cart/order
// lookups without a database.

import type { CartItem, Role, User } from '../../src/lib/domain/types'
import type { UserListFilter, UserRepository } from '../../src/lib/repositories/UserRepository'

let counter = 0

export class FakeUserRepository implements UserRepository {
  private users = new Map<string, User>()

  seed(user: User): void {
    this.users.set(user.id, user)
  }

  async getById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null
  }

  async getByEmail(email: string): Promise<User | null> {
    return Array.from(this.users.values()).find(u => u.email === email) ?? null
  }

  async list(filter: UserListFilter = {}): Promise<User[]> {
    let results = Array.from(this.users.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )
    if (filter.role) results = results.filter(u => u.roles.includes(filter.role!))
    const limit = filter.limit ?? 50
    const page = filter.page ?? 1
    return results.slice((page - 1) * limit, (page - 1) * limit + limit)
  }

  async updateCart(id: string, items: CartItem[]): Promise<User | null> {
    const user = this.users.get(id)
    if (!user) return null
    const updated = { ...user, cart: items, updatedAt: new Date() }
    this.users.set(id, updated)
    return updated
  }

  async updateRoles(id: string, roles: Role[]): Promise<User | null> {
    const user = this.users.get(id)
    if (!user) return null
    const updated = { ...user, roles, updatedAt: new Date() }
    this.users.set(id, updated)
    return updated
  }

  async updateProfile(
    id: string,
    patch: { name?: string | null; email?: string },
  ): Promise<User | null> {
    const user = this.users.get(id)
    if (!user) return null
    const updated = {
      ...user,
      name: 'name' in patch ? patch.name ?? null : user.name,
      email: typeof patch.email === 'string' ? patch.email : user.email,
      updatedAt: new Date(),
    }
    this.users.set(id, updated)
    return updated
  }

  async appendPurchases(id: string, productIds: string[]): Promise<User | null> {
    const user = this.users.get(id)
    if (!user) return null
    const updated = {
      ...user,
      purchases: Array.from(new Set([...user.purchases, ...productIds])),
      updatedAt: new Date(),
    }
    this.users.set(id, updated)
    return updated
  }
}

export const buildTestUser = (overrides: Partial<User> = {}): User => ({
  id: overrides.id ?? `user_${++counter}`,
  name: 'Test User',
  email: 'test@example.com',
  roles: ['customer'],
  purchases: [],
  cart: [],
  legacyStripeCustomerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})
