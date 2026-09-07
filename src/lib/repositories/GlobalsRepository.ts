// src/lib/repositories/GlobalsRepository.ts
//
// Read-only repository for the Header/Footer/Settings globals. Same shape
// as the other repositories here: an interface, so callers and tests depend
// on an abstraction rather than a concrete Mongo class, plus its Mongo
// implementation.
//
// Reads only. These documents are edited directly in the database (or by a
// future admin screen); nothing in the request path writes them, so there
// is no write API to misuse.
import type { Connection } from 'mongoose'

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
}

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
}
