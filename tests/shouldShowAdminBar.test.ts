// tests/shouldShowAdminBar.test.ts
import { describe, expect, it } from 'vitest'

import { shouldShowAdminBar } from '../src/app/_components/AdminBar/shouldShowAdminBar'

describe('shouldShowAdminBar', () => {
  it('hides the bar whenever native admin is enabled, even for an admin user', () => {
    expect(shouldShowAdminBar({ nativeAdminEnabled: true, isAdmin: true })).toBe(false)
  })

  it('hides the bar for a non-admin user when native admin is disabled (unchanged behavior)', () => {
    expect(shouldShowAdminBar({ nativeAdminEnabled: false, isAdmin: false })).toBe(false)
  })

  it('shows the bar for an admin user when native admin is disabled (unchanged behavior)', () => {
    expect(shouldShowAdminBar({ nativeAdminEnabled: false, isAdmin: true })).toBe(true)
  })

  it('hides the bar for a non-admin user regardless of the native admin flag', () => {
    expect(shouldShowAdminBar({ nativeAdminEnabled: true, isAdmin: false })).toBe(false)
  })
})
