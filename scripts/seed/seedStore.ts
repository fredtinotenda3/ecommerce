// scripts/seed/seedStore.ts
//
// Populates an empty database with the Terro Technology starter catalogue:
// media records for the shipped images, five categories, published
// products with real copy and prices, the storefront content pages and the
// header/footer/settings globals.
//
// Usage:
//   npm run seed:store              # create anything missing, touch nothing else
//   SEED_OVERWRITE=true npm run seed:store   # also refresh existing documents
//
// Idempotency: every document is keyed on a natural key (media filename,
// category title, product slug, page slug, global type). Re-running without
// SEED_OVERWRITE only fills gaps, so a store owner who has edited a product
// description does not lose it to a second run. With SEED_OVERWRITE the
// seeded fields are rewritten and anything else on the document is left
// alone.
//
// The images this references are the ones committed under `media/` at the
// repo root (`src/lib/media/storage.ts`'s `getMediaDir`, overridable with
// `MEDIA_DIR`), so the seeded `/media/<filename>` URLs resolve on a fresh
// checkout without copying anything.
//
// This script writes through Mongoose models directly rather than through
// the repository/service layer: the services enforce admin-session rules
// that do not apply to an offline seed, and the models are the narrowest
// dependency that still validates shape.

import { config as loadEnv } from 'dotenv'

loadEnv()

import { existsSync } from 'fs'
import path from 'path'
import type { Connection, Types } from 'mongoose'

import { closeDbConnection, getDbConnection } from '../../src/lib/db/connection'
import { getCategoryModel } from '../../src/lib/db/models/Category'
import { getGlobalModel } from '../../src/lib/db/models/Global'
import { getMediaModel } from '../../src/lib/db/models/Media'
import { getPageModel } from '../../src/lib/db/models/Page'
import { getProductModel } from '../../src/lib/db/models/Product'
import { getMediaDir } from '../../src/lib/media/storage'
import { toCategorySlug } from '../../src/app/_utilities/categorySlug'
import {
  DEFAULT_CONTACT,
  DEFAULT_FOOTER_LINK_GROUPS,
  DEFAULT_INCLUSIONS,
  DEFAULT_PRIMARY_NAV,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
  DEFAULT_SITE_TAGLINE,
  DEFAULT_SOCIAL_LINKS,
  DEFAULT_TESTIMONIALS,
} from '../../src/lib/domain/siteDefaults'
import { BRAND_BACKGROUND_IMAGE_FILENAME, SEED_CATEGORIES, SEED_MEDIA, SEED_PRODUCTS } from './catalogue'

/* eslint-disable no-console */

const OVERWRITE = process.env.SEED_OVERWRITE === 'true'
// The same directory the running application reads uploads from (see
// `src/lib/media/storage.ts`'s `getMediaDir`, overridable with `MEDIA_DIR`) —
// NOT `public/media`, which is where a previous CMS wrote uploads and which
// this repository's committed sample images no longer live under. Seeding
// against the actual serving directory means `npm run seed:store` validates
// against where the bytes really are, not a legacy path that would fail the
// existence check on every fresh checkout.
const SEEDED_MEDIA_DIR = getMediaDir()

interface Counts {
  created: number
  updated: number
  skipped: number
}

const emptyCounts = (): Counts => ({ created: 0, updated: 0, skipped: 0 })

const report = (label: string, counts: Counts): void => {
  console.log(
    `  ${label}: ${counts.created} created, ${counts.updated} updated, ${counts.skipped} unchanged`,
  )
}

/** Slate-style rich text — the shape `<RichText />` renders. */
const paragraphs = (lines: string[]): Record<string, unknown>[] =>
  lines.map(text => ({ type: 'p', children: [{ text }] }))

const heading = (text: string, type: 'h1' | 'h2' = 'h1'): Record<string, unknown> => ({
  type,
  children: [{ text }],
})

// ---------------------------------------------------------------------------
// Validation of the catalogue itself
//
// A bad `compareAtPrice` produces a "sale" badge advertising a discount that
// does not exist, and a product pointing at a missing image produces a
// broken card. Both are cheap to catch here and expensive to notice in
// production, so the script refuses to write a catalogue that fails either.
// ---------------------------------------------------------------------------

const validateCatalogue = (): void => {
  const problems: string[] = []

  const mediaFilenames = new Set(SEED_MEDIA.map(item => item.filename))

  SEED_MEDIA.forEach(item => {
    if (!existsSync(path.join(SEEDED_MEDIA_DIR, item.filename))) {
      problems.push(`media file missing on disk: ${path.join(SEEDED_MEDIA_DIR, item.filename)}`)
    }
    if (!item.alt.trim()) problems.push(`media ${item.filename} has no alt text`)
  })

  const categorySlugs = new Set<string>()
  SEED_CATEGORIES.forEach(category => {
    if (toCategorySlug(category.title) !== category.slug) {
      problems.push(
        `category "${category.title}" declares slug "${category.slug}" but its title derives "${toCategorySlug(
          category.title,
        )}" — navigation links would not match`,
      )
    }
    if (categorySlugs.has(category.slug)) problems.push(`duplicate category slug ${category.slug}`)
    categorySlugs.add(category.slug)
    if (!mediaFilenames.has(category.media)) {
      problems.push(`category ${category.title} references unknown media ${category.media}`)
    }
  })

  const productSlugs = new Set(SEED_PRODUCTS.map(product => product.slug))
  SEED_PRODUCTS.forEach(product => {
    if (!Number.isInteger(product.price) || product.price <= 0) {
      problems.push(`product ${product.slug} has a non-integer or non-positive price`)
    }
    if (product.compareAtPrice !== undefined && product.compareAtPrice <= product.price) {
      problems.push(
        `product ${product.slug} has compareAtPrice ${product.compareAtPrice} <= price ${product.price}`,
      )
    }
    if (!categorySlugs.has(product.categorySlug)) {
      problems.push(`product ${product.slug} references unknown category ${product.categorySlug}`)
    }
    if (!mediaFilenames.has(product.media)) {
      problems.push(`product ${product.slug} references unknown media ${product.media}`)
    }
    product.related.forEach(slug => {
      if (slug === product.slug) problems.push(`product ${product.slug} is related to itself`)
      if (!productSlugs.has(slug)) {
        problems.push(`product ${product.slug} relates to unknown product ${slug}`)
      }
    })
  })

  const pageSlugs = new Set<string>()
  SEED_PAGES.forEach(page => {
    if (pageSlugs.has(page.slug)) problems.push(`duplicate page slug ${page.slug}`)
    pageSlugs.add(page.slug)
    if (page.heroMedia && !mediaFilenames.has(page.heroMedia)) {
      problems.push(`page ${page.slug} references unknown hero media ${page.heroMedia}`)
    }
  })

  if (problems.length > 0) {
    console.error('The seed catalogue is not self-consistent:')
    problems.forEach(problem => console.error(`  - ${problem}`))
    throw new Error(`${problems.length} catalogue problem(s); nothing was written.`)
  }
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/** Derived from the file extension rather than hardcoded: the original
 * Tech Haven catalogue was PNG-only, so a fixed `'image/png'` never showed
 * itself as wrong, but it silently mislabelled every JPEG once the Terro
 * catalogue introduced them — the admin media table would have shown
 * "image/png" for a `.jpg` file. Static serving of `/media/*` never
 * consulted this field (Next serves the file's real bytes with a
 * Content-Type derived from its actual extension), so nothing broke, but
 * the stored metadata was simply incorrect. */
const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
}

const mimeTypeFor = (filename: string): string => {
  const extension = path.extname(filename).toLowerCase()
  return MIME_TYPES_BY_EXTENSION[extension] ?? 'application/octet-stream'
}

const seedMedia = async (connection: Connection): Promise<Map<string, Types.ObjectId>> => {
  const Media = getMediaModel(connection)
  const counts = emptyCounts()
  const ids = new Map<string, Types.ObjectId>()

  for (const item of SEED_MEDIA) {
    const fields = {
      alt: item.alt,
      filename: item.filename,
      url: `/media/${item.filename}`,
      mimeType: mimeTypeFor(item.filename),
      width: item.width,
      height: item.height,
    }

    const existing = await Media.findOne({ filename: item.filename }).exec()

    if (!existing) {
      const created = await Media.create(fields)
      ids.set(item.filename, created._id)
      counts.created += 1
    } else {
      ids.set(item.filename, existing._id)
      if (OVERWRITE) {
        await Media.updateOne({ _id: existing._id }, { $set: fields }).exec()
        counts.updated += 1
      } else {
        counts.skipped += 1
      }
    }
  }

  report('media', counts)
  return ids
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const seedCategories = async (
  connection: Connection,
  mediaIds: Map<string, Types.ObjectId>,
): Promise<Map<string, Types.ObjectId>> => {
  const Category = getCategoryModel(connection)
  const counts = emptyCounts()
  const ids = new Map<string, Types.ObjectId>()

  for (const category of SEED_CATEGORIES) {
    const fields = {
      title: category.title,
      media: mediaIds.get(category.media),
      description: category.description,
    }

    const existing = await Category.findOne({ title: category.title }).exec()

    if (!existing) {
      const created = await Category.create(fields)
      ids.set(category.slug, created._id)
      counts.created += 1
    } else {
      ids.set(category.slug, existing._id)
      if (OVERWRITE) {
        await Category.updateOne({ _id: existing._id }, { $set: fields }).exec()
        counts.updated += 1
      } else {
        counts.skipped += 1
      }
    }
  }

  report('categories', counts)
  return ids
}

// ---------------------------------------------------------------------------
// Products
//
// Written in two passes: the first creates every product, the second fills
// in `relatedProducts` once all the ids exist. A single pass would need the
// catalogue to be topologically ordered, which is a constraint on the
// content file that buys nothing.
// ---------------------------------------------------------------------------

const seedProducts = async (
  connection: Connection,
  mediaIds: Map<string, Types.ObjectId>,
  categoryIds: Map<string, Types.ObjectId>,
): Promise<void> => {
  const Product = getProductModel(connection)
  const counts = emptyCounts()
  const ids = new Map<string, Types.ObjectId>()
  const touched = new Set<string>()

  for (const product of SEED_PRODUCTS) {
    const imageId = mediaIds.get(product.media)
    const categoryId = categoryIds.get(product.categorySlug)

    const fields = {
      title: product.title,
      slug: product.slug,
      _status: 'published' as const,
      price: product.price,
      currency: product.currency,
      compareAtPrice: product.compareAtPrice ?? null,
      categories: categoryId ? [categoryId] : [],
      enablePaywall: false,
      layout: [
        {
          blockType: 'content',
          columns: [{ size: 'full', richText: paragraphs(product.body) }],
        },
      ],
      meta: {
        title: `${product.title} | ${DEFAULT_SITE_NAME}`,
        description: product.description,
        image: imageId ?? null,
      },
    }

    const existing = await Product.findOne({ slug: product.slug }).exec()

    if (!existing) {
      const created = await Product.create(fields)
      ids.set(product.slug, created._id)
      counts.created += 1
      touched.add(product.slug)
    } else {
      ids.set(product.slug, existing._id)
      if (OVERWRITE) {
        await Product.updateOne({ _id: existing._id }, { $set: fields }).exec()
        counts.updated += 1
        touched.add(product.slug)
      } else {
        counts.skipped += 1
      }
    }
  }

  // Second pass: relations. Only for products this run actually wrote, so a
  // skipped product keeps whatever relations an admin curated by hand.
  for (const product of SEED_PRODUCTS) {
    if (!touched.has(product.slug)) continue

    const self = ids.get(product.slug)
    if (!self) continue

    const related = product.related
      .map(slug => ids.get(slug))
      .filter((id): id is Types.ObjectId => Boolean(id))

    await Product.updateOne({ _id: self }, { $set: { relatedProducts: related } }).exec()
  }

  report('products', counts)
}

// ---------------------------------------------------------------------------
// Pages
//
// The storefront renders its own branded home composition (see
// `src/app/(pages)/[slug]/page.tsx`), so these pages exist to own the SEO
// metadata and the hero copy rather than to lay out the whole page.
// ---------------------------------------------------------------------------

interface SeedPage {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  heroHeading: string
  heroBody: string[]
  /** A `SEED_MEDIA` filename. When set, the page's hero renders as
   * `mediumImpact` (heading, body and a real photograph) instead of the
   * text-only `lowImpact` every other page uses — reserved for the two
   * pages where a supplied Terro asset actually illustrates the copy
   * (a repair bench, an opened device) rather than decorating it. */
  heroMedia?: string
}

const SEED_PAGES: SeedPage[] = [
  {
    slug: 'home',
    title: 'Home',
    metaTitle: 'Terro Technology | Smartphones and consumer technology, Harare',
    metaDescription:
      'Terro Technology sells boxed and preloved smartphones, laptops, gaming PCs and accessories in Harare, and repairs the devices other shops sell you. Pay with EcoCash, OneMoney or card via Paynow.',
    heroHeading: 'Smartphones and consumer technology, sorted properly',
    heroBody: [
      'Boxed and preloved phones, laptops, gaming builds and the parts that keep them running — sold and repaired from the same counter.',
    ],
  },
  {
    slug: 'products',
    title: 'All products',
    metaTitle: 'Shop all products | Terro Technology',
    metaDescription:
      'Browse the Terro Technology range: smartphones, laptops, gaming PCs, accessories and printers. Filter by category and sort by price.',
    heroHeading: 'Everything we stock',
    heroBody: [
      'Filter by category, sort by price, and message us on WhatsApp if you want a photo of the actual unit before you order — especially for preloved devices.',
    ],
  },
  {
    slug: 'cart',
    title: 'Cart',
    metaTitle: 'Your cart | Terro Technology',
    metaDescription:
      'Review the items in your Terro Technology cart and check out securely with Paynow.',
    heroHeading: 'Your cart',
    heroBody: [
      'Items stay in this browser until you sign in, after which your cart follows your account across devices.',
    ],
  },

  // --- The pages the footer links to ------------------------------------
  //
  // These exist because the footer and the 404 page link to them. A
  // storefront whose own footer leads to four 404s reads as unfinished.
  //
  // None of the three policy-shaped pages below (delivery, warranty, FAQ)
  // states a specific number — a delivery fee, a return window, a warranty
  // term — because nothing supplied by the client states one either. The
  // brief is explicit that inventing a policy the client has not approved
  // is worse than a shorter, honest page; every fixed claim here (the
  // repair service list, the payment methods, the "sold as tested" language
  // for preloved devices) is instead something an actual Terro flyer
  // states. See docs/terro-technology-setup.md for the exact numbers Terro
  // still needs to supply before this page can say anything more specific.
  {
    slug: 'delivery-and-returns',
    title: 'Delivery & returns',
    metaTitle: 'Delivery & returns | Terro Technology',
    metaDescription:
      'How delivery and returns work at Terro Technology in Harare.',
    heroHeading: 'Delivery & returns',
    heroBody: [
      'Collection from the shop is always available and always free. Delivery within Harare can be arranged — message us on WhatsApp or call before you order and we will confirm whether we can deliver to you and what it costs; we would rather quote a real number than an estimate that changes at checkout.',
      'Boxed, sealed devices are new stock and are covered by the manufacturer’s standard cover where one applies to that brand and model — ask in-store which applies to the specific device you are buying.',
      'Preloved devices are sold as tested and working, described as accurately as we can manage; because condition varies unit to unit, come in and see the actual device, or ask for photos and a description over WhatsApp, before you commit. If a preloved device is not as described, tell us — we will look at it.',
    ],
  },
  {
    slug: 'warranty',
    title: 'Warranty & repairs',
    metaTitle: 'Warranty & repairs | Terro Technology',
    metaDescription:
      'What cover applies to devices bought from Terro Technology, and the repair services available in-store.',
    heroHeading: 'Warranty & repairs',
    heroBody: [
      'Boxed, sealed devices carry the manufacturer’s standard warranty for that brand; ask in-store for the specific term that applies to what you are buying. Preloved devices are sold as tested and working at the time of sale, not with a separate written warranty.',
      'Repairs are a normal part of what we do, not an afterthought: screen and battery replacement, cracked back covers, water and liquid damage, motherboard-level component repair, and laptop screens, chargers, batteries, covers, hard drives and SSDs. Bring the device in for a quote — repair pricing depends on the fault and the model, so we do not publish a fixed price list for it.',
      'Keep your receipt or order confirmation. That is what we use to look up a purchase.',
    ],
    heroMedia: 'warranty-repair-bench.jpg',
  },
  {
    slug: 'services',
    title: 'Repairs & services',
    metaTitle: 'Repairs & services | Terro Technology',
    metaDescription:
      'Networking, programming, CCTV installation and computer repairs from Terro Technology in Harare.',
    heroHeading: 'Beyond the shop counter',
    heroBody: [
      'Sales are half of what Terro Technology does. The other half is service work: networking, programming, CCTV installation, and computer repairs, alongside the phone and laptop repairs described on the Warranty & repairs page.',
      'Every service here is quoted against the actual job rather than sold off a price list, because the same request ("fix my computer") can mean a five-minute software problem or a motherboard-level repair. Bring the device in, or describe the fault over WhatsApp or by phone, and we will quote it honestly — including telling you when a repair costs more than the device is worth.',
      'Custom gaming PC builds are quoted the same way: tell us your budget and what you play, and we will spec a build against current component pricing rather than a fixed configuration.',
    ],
  },
  {
    slug: 'faq',
    title: 'Frequently asked questions',
    metaTitle: 'FAQ | Terro Technology',
    metaDescription: 'Common questions about buying, ordering and paying at Terro Technology.',
    heroHeading: 'Frequently asked questions',
    heroBody: [
      'The questions below are the ones asked most often in-store. If yours is not here, WhatsApp or call us — the numbers are at the bottom of every page.',
      '"Is this phone/laptop genuine?" — Boxed stock is new and sealed; preloved stock is used and sold as tested and working, described as accurately as we can. If you want to inspect a specific unit before paying, come in or ask for photos over WhatsApp.',
      '"How do I pay?" — Every order on this site is paid through Paynow: EcoCash, OneMoney, Visa or Mastercard. Payment is confirmed by Paynow directly, not by us, so your order status updates automatically once it clears.',
      '"Can I get something repaired that I did not buy here?" — Yes. Repairs are quoted against the actual fault regardless of where the device was bought.',
      '"Do you deliver?" — Collection in-store is always free. For delivery, message us before you order and we will confirm whether it is available to you and what it costs.',
    ],
  },
  {
    slug: 'about',
    title: 'About Terro Technology',
    metaTitle: 'About Terro Technology',
    metaDescription:
      'Terro Technology is a Harare consumer technology retailer selling smartphones, laptops, gaming PCs and accessories, and repairing what other shops sell.',
    heroHeading: 'A shop that also fixes things',
    heroBody: [
      'Terro Technology sells smartphones, laptops, gaming PCs, accessories and printers from two counters in Harare — and repairs devices, including ones bought elsewhere. Networking, programming and CCTV installation round out the service side of the business.',
      'Boxed and preloved stock are both sold honestly, as what they are: boxed devices are new and sealed, preloved devices are used, tested and priced accordingly. We would rather tell you a cheaper preloved unit is the better buy than upsell you to a new one you do not need.',
      'Come and see a device before you commit, especially a preloved one — or ask us for a straight answer over WhatsApp first.',
    ],
    heroMedia: 'about-repair-detail.jpg',
  },
  {
    slug: 'contact',
    title: 'Contact us',
    metaTitle: 'Contact Terro Technology',
    metaDescription:
      'Talk to Terro Technology in Harare — by phone, WhatsApp, email, or at either shop counter.',
    heroHeading: 'Talk to someone who knows the stock',
    heroBody: [
      `The fastest way to reach us is WhatsApp or a call: ${DEFAULT_CONTACT.phone} or ${DEFAULT_CONTACT.phoneSecondary}. Email reaches the same people at ${DEFAULT_CONTACT.email}.`,
      `Shop No. 9, First Floor, Nhaka Parade, corner Angwa & George Silundika, Harare. A second counter trades from Shop 28, Huawei Shop, corner Angwa & Speke.`,
      'For an order already placed through this site, quote your order number and we can tell you exactly where it is.',
    ],
  },
]

const seedPages = async (
  connection: Connection,
  mediaIds: Map<string, Types.ObjectId>,
): Promise<Map<string, Types.ObjectId>> => {
  const Page = getPageModel(connection)
  const counts = emptyCounts()
  const ids = new Map<string, Types.ObjectId>()

  for (const page of SEED_PAGES) {
    const heroMediaId = page.heroMedia ? mediaIds.get(page.heroMedia) : undefined

    // `mediumImpact` (heading + body + a real photograph) only for the two
    // pages with a genuine supporting image; every other page keeps the
    // text-only `lowImpact` hero rather than a hero with no media forced
    // into a variant that expects one.
    const hero = heroMediaId
      ? {
          type: 'mediumImpact',
          richText: [heading(page.heroHeading), ...paragraphs(page.heroBody)],
          media: heroMediaId,
        }
      : {
          type: 'lowImpact',
          richText: [heading(page.heroHeading), ...paragraphs(page.heroBody)],
        }

    const fields = {
      title: page.title,
      slug: page.slug,
      _status: 'published' as const,
      hero,
      layout: [],
      meta: { title: page.metaTitle, description: page.metaDescription },
    }

    const existing = await Page.findOne({ slug: page.slug }).exec()

    if (!existing) {
      const created = await Page.create(fields)
      ids.set(page.slug, created._id)
      counts.created += 1
    } else {
      ids.set(page.slug, existing._id)
      if (OVERWRITE) {
        await Page.updateOne({ _id: existing._id }, { $set: fields }).exec()
        counts.updated += 1
      } else {
        counts.skipped += 1
      }
    }
  }

  report('pages', counts)
  return ids
}

// ---------------------------------------------------------------------------
// Globals
//
// Header, footer and settings are now fully admin-driven (see
// `/admin/globals`) — nothing about navigation, contact details, social
// links, trust badges or the brand background image is hardcoded in the
// rendering path any more (see `src/lib/domain/siteDefaults.ts`'s doc
// comment). This is the ONE place those defaults are written into the
// database, and only on first seed: re-running without SEED_OVERWRITE=true
// never touches a field an admin has since edited, and SEED_OVERWRITE
// refreshes them back to these starting values, which is exactly the
// "reset to the shipped defaults" escape hatch an operator who has made a
// mess of the admin UI needs.
// ---------------------------------------------------------------------------

/** Maps the plain `{label, href}` shape `DEFAULT_PRIMARY_NAV` uses onto the
 * `NavItem`/`link` document shape the Header/Footer globals actually store
 * (see `GlobalsRepository.ts`'s `toNavItemDocuments`) — every seeded link is
 * a plain external-style URL (`type: 'custom'`), never a page reference, so
 * renaming or removing a page later can never silently break the seeded
 * nav. */
const toSeedNavItem = (item: { label: string; href: string }): Record<string, unknown> => ({
  link: { type: 'custom', url: item.href, label: item.label, newTab: false },
})

const seedGlobals = async (
  connection: Connection,
  pageIds: Map<string, Types.ObjectId>,
  mediaIds: Map<string, Types.ObjectId>,
): Promise<void> => {
  const Global = getGlobalModel(connection)
  const counts = emptyCounts()

  const brandBackgroundImageId = mediaIds.get(BRAND_BACKGROUND_IMAGE_FILENAME) ?? null

  const desired: { globalType: string; fields: Record<string, unknown> }[] = [
    {
      globalType: 'header',
      fields: { navItems: DEFAULT_PRIMARY_NAV.map(toSeedNavItem) },
    },
    {
      globalType: 'footer',
      fields: {
        copyright: `© ${new Date().getFullYear()} ${DEFAULT_SITE_NAME}. All rights reserved.`,
        navItems: [],
        linkGroups: DEFAULT_FOOTER_LINK_GROUPS,
      },
    },
    {
      globalType: 'settings',
      fields: {
        productsPage: pageIds.get('products') ?? null,
        siteName: DEFAULT_SITE_NAME,
        siteTagline: DEFAULT_SITE_TAGLINE,
        siteDescription: DEFAULT_SITE_DESCRIPTION,
        contactEmail: DEFAULT_CONTACT.email,
        contactPhone: DEFAULT_CONTACT.phone,
        contactPhoneSecondary: DEFAULT_CONTACT.phoneSecondary,
        contactWhatsapp: DEFAULT_CONTACT.whatsapp,
        addressLines: DEFAULT_CONTACT.addressLines,
        secondAddressLines: DEFAULT_CONTACT.secondAddressLines,
        hours: DEFAULT_CONTACT.hours,
        socialLinks: DEFAULT_SOCIAL_LINKS,
        inclusions: DEFAULT_INCLUSIONS,
        testimonials: DEFAULT_TESTIMONIALS,
        brandBackgroundImage: brandBackgroundImageId,
      },
    },
  ]

  for (const entry of desired) {
    const existing = await Global.findOne({ globalType: entry.globalType }).exec()

    if (!existing) {
      await Global.create({ globalType: entry.globalType, ...entry.fields })
      counts.created += 1
    } else if (OVERWRITE) {
      await Global.updateOne({ _id: existing._id }, { $set: entry.fields }).exec()
      counts.updated += 1
    } else {
      counts.skipped += 1
    }
  }

  report('globals', counts)
}

// ---------------------------------------------------------------------------

const main = async (): Promise<void> => {
  validateCatalogue()

  console.log(
    OVERWRITE
      ? 'Seeding the Terro Technology catalogue (SEED_OVERWRITE=true — existing documents will be refreshed).'
      : 'Seeding the Terro Technology catalogue (existing documents are left untouched; set SEED_OVERWRITE=true to refresh them).',
  )

  const connection = await getDbConnection()

  const mediaIds = await seedMedia(connection)
  const categoryIds = await seedCategories(connection, mediaIds)
  await seedProducts(connection, mediaIds, categoryIds)
  const pageIds = await seedPages(connection, mediaIds)
  await seedGlobals(connection, pageIds, mediaIds)

  console.log('Done. Sign in at /admin to review and edit the catalogue.')

  await closeDbConnection()
}

main().catch(async error => {
  console.error('Seeding failed:', error)
  await closeDbConnection().catch(() => undefined)
  process.exit(1)
})

/* eslint-enable no-console */
