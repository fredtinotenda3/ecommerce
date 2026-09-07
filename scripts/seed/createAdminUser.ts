// scripts/seed/createAdminUser.ts
//
// Creates (or promotes) an administrator account, so a fresh deployment
// has a way in to /admin.
//
// This is the only way to create the FIRST administrator: self-registration
// always produces a `customer`, and the admin API's role endpoint requires
// an existing admin session. Once one admin exists, further admins are
// promoted from /admin/customers.
//
// Usage:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npm run seed:admin
//
// The password is read from the environment rather than an argument so it
// does not land in shell history or a process listing. Nothing is printed
// except the email and the resulting role.
//
// Re-running is safe: an existing account with that email is promoted to
// admin, and its password is only reset if ADMIN_RESET_PASSWORD=true.

import { config as loadEnv } from 'dotenv'

loadEnv()

import { hashPasswordPayloadCompatible, MIN_NATIVE_PASSWORD_LENGTH } from '../../src/lib/auth/password'
import { closeDbConnection, getDbConnection } from '../../src/lib/db/connection'
import { getUserModel } from '../../src/lib/db/models/User'

/* eslint-disable no-console */
const main = async (): Promise<void> => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD || ''
  const name = process.env.ADMIN_NAME || 'Administrator'
  const resetPassword = process.env.ADMIN_RESET_PASSWORD === 'true'

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD are both required.')
    process.exit(1)
  }

  if (password.length < MIN_NATIVE_PASSWORD_LENGTH) {
    console.error(`ADMIN_PASSWORD must be at least ${MIN_NATIVE_PASSWORD_LENGTH} characters.`)
    process.exit(1)
  }

  const connection = await getDbConnection()
  const User = getUserModel(connection)

  const existing = await User.findOne({ email }).exec()

  if (existing) {
    const update: Record<string, unknown> = { roles: ['admin', 'customer'] }

    if (resetPassword) {
      const { hash, salt } = await hashPasswordPayloadCompatible(password)
      update.hash = hash
      update.salt = salt
      update.loginAttempts = 0
      update.lockUntil = null
    }

    await User.updateOne({ _id: existing._id }, { $set: update }).exec()
    console.log(
      `Existing account ${email} promoted to admin${
        resetPassword ? ' and its password reset' : ' (password unchanged)'
      }.`,
    )
  } else {
    const { hash, salt } = await hashPasswordPayloadCompatible(password)
    await User.create({
      email,
      name,
      hash,
      salt,
      roles: ['admin', 'customer'],
      loginAttempts: 0,
    })
    console.log(`Admin account created for ${email}.`)
  }

  await closeDbConnection()
}

main().catch(async error => {
  console.error('Failed to create the admin account:', error)
  await closeDbConnection().catch(() => undefined)
  process.exit(1)
})
/* eslint-enable no-console */
