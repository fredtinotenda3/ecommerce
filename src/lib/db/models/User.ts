// src/lib/db/models/User.ts
//
// Maps onto the existing `users` collection. Payload's `auth: true`
// option adds its own authentication fields at write time: `hash`,
// `salt`, `loginAttempts`, `lockUntil`, `resetPasswordToken`,
// `resetPasswordExpiration` (see
// node_modules/payload/dist/auth/baseFields/*.js). Phase 1 through 4 left
// these as untouched passthrough fields (via `strict: false`) since
// nothing native read/wrote them yet.
//
// the native auth service (src/lib/services/AuthService.ts, via
// src/lib/repositories/AuthUserRepository.ts) now reads and writes these
// fields directly, so they're declared explicitly below rather than left
// implicit. `strict: false` is kept so any other Payload-internal auth
// field not listed here (present or future) still round-trips safely
// instead of being silently dropped.

import type { Model } from 'mongoose'
import { type Connection, type Document, Schema, type Types } from 'mongoose'

import { getOrCreateModel } from './getOrCreateModel'

export interface CartItemSubdocument {
  product: Types.ObjectId
  quantity: number
}

export interface UserDocument extends Document {
  _id: Types.ObjectId
  name?: string | null
  email: string
  roles?: string[]
  purchases?: Types.ObjectId[]
  cart?: { items?: CartItemSubdocument[] }

  // --- Legacy Stripe field (untouched, read-only from this layer) ---
  stripeCustomerID?: string | null

  // --- Phase 10: preserved copy of stripeCustomerID, written by
  // scripts/migrations/preserveUserLegacyStripeId.ts. `stripeCustomerID`
  // itself is NOT removed by that migration — see the parallel comment on
  // ProductDocument.legacyStripeProductId. ---
  legacyStripeCustomerId?: string | null

  // --- Payload auth fields (read/written by native auth) ---
  hash?: string | null
  salt?: string | null
  loginAttempts?: number | null
  lockUntil?: Date | null
  resetPasswordToken?: string | null
  resetPasswordExpiration?: Date | null

  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<UserDocument>(
  {
    name: { type: String },
    email: { type: String },
    roles: [{ type: String }],
    purchases: [{ type: Schema.Types.ObjectId, ref: 'products' }],
    cart: {
      items: [
        {
          _id: false,
          product: { type: Schema.Types.ObjectId, ref: 'products' },
          quantity: { type: Number },
        },
      ],
    },
    stripeCustomerID: { type: String },
    legacyStripeCustomerId: { type: String, default: null },

    // --- Payload auth fields (PHASE 5) ---
    hash: { type: String },
    salt: { type: String },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpiration: { type: Date },
  },
  {
    strict: false,
    timestamps: true,
    collection: 'users',
  },
)

UserSchema.index({ email: 1 })

export const getUserModel = (connection: Connection): Model<UserDocument> =>
  getOrCreateModel<UserDocument>(connection, 'NativeUser', UserSchema, 'users')
