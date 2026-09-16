// src/lib/repositories/GlobalsRepository.ts
//
// Read-only repository for the Header/Footer/Settings globals. Same shape
// as the other repositories here: an interface, so callers and tests depend
// on an abstraction rather than a concrete Mongo class, plus its Mongo
// implementation.
//
// Reads on the request path; writes only from the admin API, which
// upserts each global by its `globalType` discriminator so there is
// exactly one Header, one Footer and one Settings document.
import { type Connection, Types } from 'mongoose'

import {
  getGlobalModel,
  type GlobalDocument,
  type GlobalNavItemDocument,
} from '../db/models/Global'
import type { Footer, Header, Home, NavItem, Settings } from '../domain/types'

export interface HomeWriteInput {
  heroEyebrow: string | null
  heroHeading: string | null
  heroHeadingAccent: string | null
  heroLede: string | null
  heroProofPoints: string[]
  heroPrimaryCtaLabel: string | null
  heroPrimaryCtaHref: string | null
  heroSecondaryCtaLabel: string | null
  heroSecondaryCtaHref: string | null
  heroImageId: string | null
  videoEyebrow: string | null
  videoHeading: string | null
  videoLede: string | null
  videoLinkLabel: string | null
  videoLinkHref: string | null
  videoId: string | null
  videoPosterId: string | null
}

export interface GlobalsRepository {
  getHeader(): Promise<Header | null>
  getFooter(): Promise<Footer | null>
  getSettings(): Promise<Settings | null>
  getHome(): Promise<Home | null>
  saveHeader(input: { navItems: NavItem[] }): Promise<Header>
  saveFooter(input: { copyright: string | null; navItems: NavItem[] }): Promise<Footer>
  saveSettings(input: { productsPageId: string | null }): Promise<Settings>
  saveHome(input: HomeWriteInput): Promise<Home>
}

/** Inverse of `toNavItems`: maps the domain shape back onto the stored
 * document shape. A `reference` link stores `{ relationTo, value }` (the
 * polymorphic shape these documents have always used); a `custom` link
 * stores a plain url, and the two are mutually exclusive so a link can
 * never carry a stale reference from before it was switched. */
const toNavItemDocuments = (navItems: NavItem[]): GlobalNavItemDocument[] =>
  navItems.map(item => {
    const link: GlobalNavItemDocument['link'] = {
      type: item.link.type === 'reference' ? 'reference' : 'custom',
      newTab: Boolean(item.link.newTab),
      label: item.link.label ?? undefined,
      
    }

    if (item.link.type === 'reference' && item.link.referencePageId) {
      link.reference = {
        relationTo: 'pages',
        value: new Types.ObjectId(item.link.referencePageId),
      }
    } else {
      link.url = item.link.url ?? undefined
    }

    if (item.link.iconMediaId) {
      link.icon = new Types.ObjectId(item.link.iconMediaId)
    }

    return { link }
  })

const toNavItems = (navItems: GlobalNavItemDocument[] | undefined): NavItem[] =>
  (navItems ?? []).map(item => ({
    link: {
      type: item.link?.type,
      newTab: item.link?.newTab,
      label: item.link?.label ?? null,
      url: item.link?.url ?? null,
      referencePageId: item.link?.reference?.value ? item.link.reference.value.toString() : null,
      referenceRelationTo: item.link?.reference?.relationTo === 'pages' ? 'pages' : null,
      iconMediaId: item.link?.icon ? item.link.icon.toString() : null,
    },
  }))

const toHome = (global: GlobalDocument): Home => ({
  id: global._id.toString(),
  heroEyebrow: global.heroEyebrow ?? null,
  heroHeading: global.heroHeading ?? null,
  heroHeadingAccent: global.heroHeadingAccent ?? null,
  heroLede: global.heroLede ?? null,
  heroProofPoints: Array.isArray(global.heroProofPoints) ? global.heroProofPoints : [],
  heroPrimaryCtaLabel: global.heroPrimaryCtaLabel ?? null,
  heroPrimaryCtaHref: global.heroPrimaryCtaHref ?? null,
  heroSecondaryCtaLabel: global.heroSecondaryCtaLabel ?? null,
  heroSecondaryCtaHref: global.heroSecondaryCtaHref ?? null,
  heroImageId: global.heroImage ? global.heroImage.toString() : null,
  videoEyebrow: global.videoEyebrow ?? null,
  videoHeading: global.videoHeading ?? null,
  videoLede: global.videoLede ?? null,
  videoLinkLabel: global.videoLinkLabel ?? null,
  videoLinkHref: global.videoLinkHref ?? null,
  videoId: global.video ? global.video.toString() : null,
  videoPosterId: global.videoPoster ? global.videoPoster.toString() : null,
  createdAt: global.createdAt,
  updatedAt: global.updatedAt,
})

export class MongoGlobalsRepository implements GlobalsRepository {
  private readonly connection: Connection

  constructor(connection: Connection) {
    this.connection = connection
  }

  async getHeader(): Promise<Header | null> {
    const Model = getGlobalModel(this.connection)
    const doc = await Model.findOne({ globalType: 'header' }).lean<GlobalDocument>().exec()
    if (!doc) return null
    const global = doc as unknown as GlobalDocument
    return {
      id: global._id.toString(),
      navItems: toNavItems(global.navItems),
      createdAt: global.createdAt,
      updatedAt: global.updatedAt,
    }
  }

  async getFooter(): Promise<Footer | null> {
    const Model = getGlobalModel(this.connection)
    const doc = await Model.findOne({ globalType: 'footer' }).lean<GlobalDocument>().exec()
    if (!doc) return null
    const global = doc as unknown as GlobalDocument
    return {
      id: global._id.toString(),
      copyright: global.copyright ?? null,
      navItems: toNavItems(global.navItems),
      createdAt: global.createdAt,
      updatedAt: global.updatedAt,
    }
  }

  async getSettings(): Promise<Settings | null> {
    const Model = getGlobalModel(this.connection)
    const doc = await Model.findOne({ globalType: 'settings' }).lean<GlobalDocument>().exec()
    if (!doc) return null
    const global = doc as unknown as GlobalDocument
    return {
      id: global._id.toString(),
      productsPageId: global.productsPage ? global.productsPage.toString() : null,
      createdAt: global.createdAt,
      updatedAt: global.updatedAt,
    }
  }

  async saveHeader(input: { navItems: NavItem[] }): Promise<Header> {
    const Model = getGlobalModel(this.connection)
    const doc = await Model.findOneAndUpdate(
      { globalType: 'header' },
      { $set: { navItems: toNavItemDocuments(input.navItems) }, $setOnInsert: { globalType: 'header' } },
      { new: true, upsert: true },
    )
      .lean<GlobalDocument>()
      .exec()

    const global = doc as unknown as GlobalDocument
    return {
      id: global._id.toString(),
      navItems: toNavItems(global.navItems),
      createdAt: global.createdAt,
      updatedAt: global.updatedAt,
    }
  }

  async saveFooter(input: { copyright: string | null; navItems: NavItem[] }): Promise<Footer> {
    const Model = getGlobalModel(this.connection)
    const doc = await Model.findOneAndUpdate(
      { globalType: 'footer' },
      {
        $set: {
          copyright: input.copyright ?? '',
          navItems: toNavItemDocuments(input.navItems),
        },
        $setOnInsert: { globalType: 'footer' },
      },
      { new: true, upsert: true },
    )
      .lean<GlobalDocument>()
      .exec()

    const global = doc as unknown as GlobalDocument
    return {
      id: global._id.toString(),
      copyright: global.copyright ?? null,
      navItems: toNavItems(global.navItems),
      createdAt: global.createdAt,
      updatedAt: global.updatedAt,
    }
  }

  async saveSettings(input: { productsPageId: string | null }): Promise<Settings> {
    const Model = getGlobalModel(this.connection)
    const doc = await Model.findOneAndUpdate(
      { globalType: 'settings' },
      {
        $set: {
          productsPage: input.productsPageId ? new Types.ObjectId(input.productsPageId) : null,
        },
        $setOnInsert: { globalType: 'settings' },
      },
      { new: true, upsert: true },
    )
      .lean<GlobalDocument>()
      .exec()

    const global = doc as unknown as GlobalDocument
    return {
      id: global._id.toString(),
      productsPageId: global.productsPage ? global.productsPage.toString() : null,
      createdAt: global.createdAt,
      updatedAt: global.updatedAt,
    }
  }

  async getHome(): Promise<Home | null> {
    const Model = getGlobalModel(this.connection)
    const doc = await Model.findOne({ globalType: 'home' }).lean<GlobalDocument>().exec()
    if (!doc) return null
    return toHome(doc as unknown as GlobalDocument)
  }

  async saveHome(input: HomeWriteInput): Promise<Home> {
    const Model = getGlobalModel(this.connection)
    const asId = (value: string | null): Types.ObjectId | null =>
      value ? new Types.ObjectId(value) : null

    const doc = await Model.findOneAndUpdate(
      { globalType: 'home' },
      {
        $set: {
          heroEyebrow: input.heroEyebrow,
          heroHeading: input.heroHeading,
          heroHeadingAccent: input.heroHeadingAccent,
          heroLede: input.heroLede,
          heroProofPoints: input.heroProofPoints,
          heroPrimaryCtaLabel: input.heroPrimaryCtaLabel,
          heroPrimaryCtaHref: input.heroPrimaryCtaHref,
          heroSecondaryCtaLabel: input.heroSecondaryCtaLabel,
          heroSecondaryCtaHref: input.heroSecondaryCtaHref,
          heroImage: asId(input.heroImageId),
          videoEyebrow: input.videoEyebrow,
          videoHeading: input.videoHeading,
          videoLede: input.videoLede,
          videoLinkLabel: input.videoLinkLabel,
          videoLinkHref: input.videoLinkHref,
          video: asId(input.videoId),
          videoPoster: asId(input.videoPosterId),
        },
        $setOnInsert: { globalType: 'home' },
      },
      { new: true, upsert: true },
    )
      .lean<GlobalDocument>()
      .exec()

    return toHome(doc as unknown as GlobalDocument)
  }
}
