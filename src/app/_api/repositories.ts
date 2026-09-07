// src/app/_api/repositories.ts
//
// One place that binds repository classes to the shared Mongoose
// connection. Every `fetch*` helper and route handler in `src/app` builds
// its repositories from here, so the connection-handling policy lives in
// exactly one file rather than being repeated per call site.
//
// The orchestration functions these repositories are passed into take
// INTERFACES, never these concrete classes, so they stay unit-testable
// with the fakes in `tests/fakes` and never require a database.

import type { Connection } from 'mongoose'

import { getDbConnection } from '../../lib/db/connection'
import { MongoAuthUserRepository } from '../../lib/repositories/AuthUserRepository'
import { MongoCategoryRepository } from '../../lib/repositories/CategoryRepository'
import { MongoGlobalsRepository } from '../../lib/repositories/GlobalsRepository'
import { MongoMediaRepository } from '../../lib/repositories/MediaRepository'
import { MongoOrderRepository } from '../../lib/repositories/OrderRepository'
import { MongoPageRepository } from '../../lib/repositories/PageRepository'
import { MongoPaymentRepository } from '../../lib/repositories/PaymentRepository'
import { MongoProductRepository } from '../../lib/repositories/ProductRepository'
import { MongoRedirectRepository } from '../../lib/repositories/RedirectRepository'
import { MongoUserRepository } from '../../lib/repositories/UserRepository'

export interface Repositories {
  connection: Connection
  authUsers: MongoAuthUserRepository
  categories: MongoCategoryRepository
  globals: MongoGlobalsRepository
  media: MongoMediaRepository
  orders: MongoOrderRepository
  pages: MongoPageRepository
  payments: MongoPaymentRepository
  products: MongoProductRepository
  redirects: MongoRedirectRepository
  users: MongoUserRepository
}

/** Repository instances are cheap value objects over a shared connection —
 * they hold no per-request state, so constructing them per call is
 * deliberate and avoids any cross-request leakage. */
export const getRepositories = async (): Promise<Repositories> => {
  const connection = await getDbConnection()

  return {
    connection,
    authUsers: new MongoAuthUserRepository(connection),
    categories: new MongoCategoryRepository(connection),
    globals: new MongoGlobalsRepository(connection),
    media: new MongoMediaRepository(connection),
    orders: new MongoOrderRepository(connection),
    pages: new MongoPageRepository(connection),
    payments: new MongoPaymentRepository(connection),
    products: new MongoProductRepository(connection),
    redirects: new MongoRedirectRepository(connection),
    users: new MongoUserRepository(connection),
  }
}
