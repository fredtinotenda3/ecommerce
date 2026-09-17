// src/lib/db/models/Global.ts
//
// maps onto Payload's existing `globals` collection.
//
// The previous CMS stored ALL globals (Header,
// Footer, Settings, ...) as separate documents in a single `globals`
// collection, discriminated by a `globalType` field equal to the global's
// slug
// — `discriminatorKey: 'globalType'`, `mongoose.model('globals', ...)`).
//
// The `link` field (src/payload/fields/link.ts) declares its `reference`
// relationship as `relationTo: ['pages']` — an ARRAY, even though there is
// only one type in it — which makes Payload treat it as a polymorphic
// relation and store it as `{ relationTo: 'pages', value: ObjectId }`
// rather than a bare ObjectId (see buildSchema.js's
// `hasManyRelations = Array.isArray(field.relationTo)`). The link's `icon`
// (an `upload` field with a plain string `relationTo: 'media'`) and
// Settings' `productsPage` (a plain `relationTo: 'pages'`) are singular
// relations, so those ARE stored as bare ObjectIds.
//
// This model is intentionally read-shape-only (`strict: false`) — it does
// not attempt to own global write/validation semantics, same treatment as
// Category/Page/Media in this directory.
import type { Model } from 'mongoose'
import { type Connection, type Document, Schema, type Types } from 'mongoose'

import { getOrCreateModel } from './getOrCreateModel'

export interface GlobalLinkDocument {
  type?: 'reference' | 'custom'
  newTab?: boolean
  label?: string
  url?: string
  reference?: {
    relationTo?: string
    value?: Types.ObjectId
  } | null
  icon?: Types.ObjectId | null
}

export interface GlobalNavItemDocument {
  link?: GlobalLinkDocument
  id?: string
}

/** One entry in Settings' `socialLinks`. `platform` selects which bundled
 * glyph renders (see `SOCIAL_ICONS` in FooterComponent) — an operator picks
 * a platform and pastes a url, rather than uploading an icon file for a
 * network the app already knows how to draw. */
export interface GlobalSocialLinkDocument {
  platform?: 'instagram' | 'facebook' | 'whatsapp' | 'tiktok' | 'x' | 'youtube' | 'linkedin' | 'other'
  label?: string
  url?: string
}

/** One of the trust badges shown on the homepage "why buy here" band and
 * the product buying panel. `icon` selects a bundled glyph the same way
 * `GlobalSocialLinkDocument.platform` does. */
export interface GlobalInclusionDocument {
  title?: string
  description?: string
  icon?: 'box' | 'repair' | 'payment' | 'message'
}

export interface GlobalTestimonialDocument {
  quote?: string
  name?: string
  role?: string
}

export interface GlobalFooterLinkDocument {
  label?: string
  href?: string
}

export interface GlobalFooterLinkGroupDocument {
  title?: string
  links?: GlobalFooterLinkDocument[]
}

export interface GlobalDocument extends Document {
  _id: Types.ObjectId
  globalType: 'header' | 'footer' | 'settings' | 'home' | string
  copyright?: string
  navItems?: GlobalNavItemDocument[]
  productsPage?: Types.ObjectId | null

  // `footer` global fields beyond `copyright`/`navItems` above.
  linkGroups?: GlobalFooterLinkGroupDocument[]

  // `settings` global fields beyond `productsPage` above — the site
  // identity and business facts that used to be hardcoded in
  // `src/app/constants/brand.ts`. See `src/lib/domain/siteDefaults.ts` for
  // the one-time defaults the seed script writes here.
  siteName?: string | null
  siteTagline?: string | null
  siteDescription?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  contactPhoneSecondary?: string | null
  contactWhatsapp?: string | null
  addressLines?: string[]
  secondAddressLines?: string[]
  hours?: string | null
  socialLinks?: GlobalSocialLinkDocument[]
  inclusions?: GlobalInclusionDocument[]
  testimonials?: GlobalTestimonialDocument[]
  /** The site-wide decorative "electric-blue circuit" backdrop: reused as
   * the homepage hero panel, the footer band, and the fallback social-share
   * image — one admin upload, several render sites (see
   * `globalsStorefrontAdapter.ts`). */
  brandBackgroundImage?: Types.ObjectId | null

  // `home` global fields. Flat rather than nested (`heroImage` not
  // `hero.image`) so the `strict: false` schema stores them exactly as
  // `GlobalsRepository`'s `$set` writes them, with no separate migration.
  heroEyebrow?: string | null
  heroHeading?: string | null
  heroHeadingAccent?: string | null
  heroLede?: string | null
  heroProofPoints?: string[]
  heroPrimaryCtaLabel?: string | null
  heroPrimaryCtaHref?: string | null
  heroSecondaryCtaLabel?: string | null
  heroSecondaryCtaHref?: string | null
  heroImage?: Types.ObjectId | null
  videoEyebrow?: string | null
  videoHeading?: string | null
  videoLede?: string | null
  videoLinkLabel?: string | null
  videoLinkHref?: string | null
  video?: Types.ObjectId | null
  videoPoster?: Types.ObjectId | null

  createdAt: Date
  updatedAt: Date
}

const GlobalSchema = new Schema<GlobalDocument>(
  {
    globalType: { type: String },
  },
  {
    strict: false,
    timestamps: true,
    collection: 'globals',
  },
)

export const getGlobalModel = (connection: Connection): Model<GlobalDocument> =>
  getOrCreateModel<GlobalDocument>(connection, 'NativeGlobal', GlobalSchema, 'globals')
