// src/lib/auth/roles.ts
//
// Foundation only — mirrors the role model already in use by Payload's
// Users collection (`roles: ['admin' | 'customer']`, see the audit's
// Authentication Audit) so a future switch to native auth doesn't also
// require redesigning authorization semantics at the same time.

import type { Role } from '../domain/types'

export const isAdmin = (roles: Role[]): boolean => roles.includes('admin')

export const isCustomer = (roles: Role[]): boolean => roles.includes('customer')

export const hasAnyRole = (roles: Role[], required: Role[]): boolean =>
  required.some(r => roles.includes(r))

export const assertHasRole = (roles: Role[], required: Role[]): void => {
  if (!hasAnyRole(roles, required)) {
    throw new Error(
      `Access denied: requires one of [${required.join(', ')}], has [${roles.join(', ')}]`,
    )
  }
}
