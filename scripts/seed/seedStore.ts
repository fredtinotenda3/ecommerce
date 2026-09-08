// scripts/seed/seedStore.ts
//
// Populates an empty database with the Tech Haven demo catalogue: media
// records for the shipped images, six categories, fifteen published
// products with real copy and prices, the `home`/`cart`/`products` pages
// and the header/footer/settings globals.
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
// The images this references are the ones committed under `public/media/`.
// `src/lib/media/storage.ts` falls back to that directory when a file is
// not in MEDIA_DIR, so the seeded `/media/<filename>` URLs resolve on a
// fresh checkout without copying anything.
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
import { toCategorySlug } from '../../src/app/_utilities/categorySlug'
import { SEED_CATEGORIES, SEED_MEDIA, SEED_PRODUCTS } from './catalogue'

/* eslint-disable no-console */

const OVERWRITE = process.env.SEED_OVERWRITE === 'true'
const PUBLIC_MEDIA_DIR = path.resolve(process.cwd(), 'public', 'media')

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
    if (!existsSync(path.join(PUBLIC_MEDIA_DIR, item.filename))) {
      problems.push(`media file missing on disk: public/media/${item.filename}`)
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

  if (problems.length > 0) {
    console.error('The seed catalogue is not self-consistent:')
    problems.forEach(problem => console.error(`  - ${problem}`))
    throw new Error(`${problems.length} catalogue problem(s); nothing was written.`)
  }
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

const seedMedia = async (connection: Connection): Promise<Map<string, Types.ObjectId>> => {
  const Media = getMediaModel(connection)
  const counts = emptyCounts()
  const ids = new Map<string, Types.ObjectId>()

  for (const item of SEED_MEDIA) {
    const fields = {
      alt: item.alt,
      filename: item.filename,
      url: `/media/${item.filename}`,
      mimeType: 'image/png',
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
        title: `${product.title} | Tech Haven`,
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
}

const SEED_PAGES: SeedPage[] = [
  {
    slug: 'home',
    title: 'Home',
    metaTitle: 'Tech Haven | Premium tech, honestly priced',
    metaDescription:
      'Genuine Apple laptops, phones, tablets, watches and audio, with a two-year warranty and free delivery over $150. Pay with EcoCash, OneMoney or card via Paynow.',
    heroHeading: 'Premium tech, honestly priced',
    heroBody: [
      'Sealed stock, a two-year warranty on every device, and someone on the end of the phone who has actually used what you are buying.',
    ],
  },
  {
    slug: 'products',
    title: 'All products',
    metaTitle: 'Shop all products | Tech Haven',
    metaDescription:
      'Browse the full Tech Haven range: MacBooks, iPhones, iPads, Apple Watch, Apple TV and audio. Filter by category and sort by price.',
    heroHeading: 'Everything we stock',
    heroBody: [
      'Filter by category, sort by price, and check availability before you travel. If something is out of stock, ask us — we can usually give you a real date.',
    ],
  },
  {
    slug: 'cart',
    title: 'Cart',
    metaTitle: 'Your cart | Tech Haven',
    metaDescription:
      'Review the items in your Tech Haven cart and check out securely with Paynow.',
    heroHeading: 'Your cart',
    heroBody: [
      'Items stay in this browser until you sign in, after which your cart follows your account across devices.',
    ],
  },

  // --- The pages the footer links to ------------------------------------
  //
  // These exist because the footer and the 404 page link to them. A
  // storefront whose own footer leads to four 404s reads as unfinished, and
  // the content below is the information a customer actually asks for
  // before buying an expensive device.
  {
    slug: 'delivery-and-returns',
    title: 'Delivery & returns',
    metaTitle: 'Delivery & returns | Tech Haven',
    metaDescription:
      'Free next-day delivery on Tech Haven orders over $150, nationwide. Thirty days to change your mind on anything unused and in its packaging.',
    heroHeading: 'Delivery & returns',
    heroBody: [
      'Orders placed before 2pm on a working day are dispatched the same afternoon. Delivery is free on orders over $150 anywhere in Zimbabwe; below that we quote the courier rate at checkout rather than marking it up.',
      'Harare deliveries usually arrive the next working day. Bulawayo, Mutare and Gweru are typically two days. Somewhere else? Ask us before you order and we will give you a real date rather than an optimistic one.',
      'You have thirty days to change your mind. Anything unused and in its original packaging can come back for a full refund, and we cover the return courier if the fault is ours. Devices that have been set up and used are still covered by the warranty below, but are no longer returnable as new stock.',
    ],
  },
  {
    slug: 'warranty',
    title: 'Warranty',
    metaTitle: 'Two-year warranty | Tech Haven',
    metaDescription:
      'Every device sold by Tech Haven carries a two-year local warranty on top of the manufacturer cover, handled in Harare.',
    heroHeading: 'Two years, handled locally',
    heroBody: [
      'Every device we sell carries a two-year Tech Haven warranty in addition to the manufacturer cover. It is handled here in Harare, so a repair does not mean shipping your laptop abroad and waiting a month for news.',
      'The warranty covers manufacturing defects and hardware failure under normal use. It does not cover accidental damage, liquid damage, or a device that has been opened by someone else — those we can still repair, but as a quoted job rather than a warranty claim.',
      'Keep your order number. That is all we need to look up a purchase; there is no card to lose and no registration to remember.',
    ],
  },
  {
    slug: 'about',
    title: 'About Tech Haven',
    metaTitle: 'About Tech Haven',
    metaDescription:
      'Tech Haven is a Harare technology retailer selling genuine Apple hardware with a two-year local warranty and advice you can act on.',
    heroHeading: 'A shop, not a warehouse',
    heroBody: [
      'Tech Haven sells Apple hardware in Harare. Everything is sealed, genuine stock with local warranty paperwork in the box — not grey imports, and not refurbished units described as new.',
      'The part we care most about is the advice. If the cheaper model does what you need, we will say so; if the machine you are looking at will be too slow for the work you have described, we will say that too. We would rather lose a sale than have it come back in a month.',
      'Come and see the demo units before you commit, especially for anything you are going to wear or carry every day.',
    ],
  },
  {
    slug: 'contact',
    title: 'Contact us',
    metaTitle: 'Contact Tech Haven',
    metaDescription:
      'Talk to Tech Haven in Harare — by phone, by email, or in the shop on Samora Machel Avenue, Monday to Saturday.',
    heroHeading: 'Talk to someone who has used it',
    heroBody: [
      'The fastest way to reach us is the phone, Monday to Saturday, 08:00 to 18:00 CAT: +263 77 000 0000. Email reaches the same people at support@techhaven.example and is usually answered the same working day.',
      'The shop is at 14 Samora Machel Avenue, Harare. Demo units for every current model are set up and switched on — you are welcome to spend as long as you like with one before deciding.',
      'For an order already placed, quote the order number and we can tell you exactly where it is.',
    ],
  },
]

const seedPages = async (connection: Connection): Promise<Map<string, Types.ObjectId>> => {
  const Page = getPageModel(connection)
  const counts = emptyCounts()
  const ids = new Map<string, Types.ObjectId>()

  for (const page of SEED_PAGES) {
    const fields = {
      title: page.title,
      slug: page.slug,
      _status: 'published' as const,
      hero: {
        type: 'lowImpact',
        richText: [heading(page.heroHeading), ...paragraphs(page.heroBody)],
      },
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
// The header and footer both render a built-in navigation from
// `constants/brand.ts`, so these globals only carry what genuinely belongs
// to an editor: the copyright line and the products-page relation used by
// the cart and checkout screens.
// ---------------------------------------------------------------------------

const seedGlobals = async (
  connection: Connection,
  pageIds: Map<string, Types.ObjectId>,
): Promise<void> => {
  const Global = getGlobalModel(connection)
  const counts = emptyCounts()

  const desired: { globalType: string; fields: Record<string, unknown> }[] = [
    { globalType: 'header', fields: { navItems: [] } },
    {
      globalType: 'footer',
      fields: {
        copyright: `© ${new Date().getFullYear()} Tech Haven. All rights reserved.`,
        navItems: [],
      },
    },
    {
      globalType: 'settings',
      fields: { productsPage: pageIds.get('products') ?? null },
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
      ? 'Seeding the Tech Haven catalogue (SEED_OVERWRITE=true — existing documents will be refreshed).'
      : 'Seeding the Tech Haven catalogue (existing documents are left untouched; set SEED_OVERWRITE=true to refresh them).',
  )

  const connection = await getDbConnection()

  const mediaIds = await seedMedia(connection)
  const categoryIds = await seedCategories(connection, mediaIds)
  await seedProducts(connection, mediaIds, categoryIds)
  const pageIds = await seedPages(connection)
  await seedGlobals(connection, pageIds)

  console.log('Done. Sign in at /admin to review and edit the catalogue.')

  await closeDbConnection()
}

main().catch(async error => {
  console.error('Seeding failed:', error)
  await closeDbConnection().catch(() => undefined)
  process.exit(1)
})

/* eslint-enable no-console */
