// src/lib/db/models/User.ts
//
// Maps onto the existing `users` collection. Payload's `auth: true`
// option adds its own authentication fields at write time (password hash
// under a Payload-internal field name, salt, login attempt tracking,
// etc.) — those are intentionally left untouched/passthrough here.
// This model does NOT implement authentication; see src/lib/auth for the
// (not-yet-wired) native auth foundation, which will define its own
// explicit hash field when it's actually activated in a later phase.

import { Schema, type Connection, type Document, type Types } from 'mongoose'
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
  },
  {
    strict: false,
    timestamps: true,
    collection: 'users',
  },
)

UserSchema.index({ email: 1 })

export const getUserModel = (connection: Connection) =>
  getOrCreateModel<UserDocument>(connection, 'NativeUser', UserSchema, 'users')