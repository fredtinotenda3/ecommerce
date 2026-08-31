// src/lib/repositories/GlobalsRepository.ts
//
// PHASE 13D — read-only native repository for the Header/Footer/Settings
// globals. Mirrors the CategoryRepository/PageRepository/MediaRepository
// pattern in this directory: an interface (so callers/tests can depend on
// an abstraction, not a concrete Mongo class) plus a Mongo implementation.
//
// This performs READS ONLY, matching the storefront's own read-only use of
// these globals today (see src/app/_api/fetchGlobals.ts) — Payload's admin
// UI remains the only way to edit Header/Footer/Settings while Payload is
// still in place.
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
