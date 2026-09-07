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
import type { Footer, Header, NavItem, Settings } from '../domain/types'

export interface GlobalsRepository {
  getHeader(): Promise<Header | null>
  getFooter(): Promise<Footer | null>
  getSettings(): Promise<Settings | null>
  saveHeader(input: { navItems: NavItem[] }): Promise<Header>
  saveFooter(input: { copyright: string | null; navItems: NavItem[] }): Promise<Footer>
  saveSettings(input: { productsPageId: string | null }): Promise<Settings>
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
}
