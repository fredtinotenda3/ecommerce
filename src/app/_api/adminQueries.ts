// src/app/_api/adminQueries.ts
//
// PHASE 6 — DB-wired entry points for the native admin area's read-only
// pages. Mirrors the fetchProductNative.ts / authNative.ts split:
// `AdminQueryService.ts` takes repository INTERFACES for unit testing,
// and this file supplies the concrete `Mongo*Repository` classes wired
// to the real DB connection for the actual page components to call.
//
// READ-ONLY — every function here only ever calls repository read
// methods (`getById`, `getBySlug`, `list`, `getByCustomer`,
// `getByOrderId`), never create/update/delete.

import { getDbConnection } from '../../lib/db/connection'
import type { Page } from '../../lib/domain/types'
import { MongoCategoryRepository } from '../../lib/repositories/CategoryRepository'
import { MongoMediaRepository } from '../../lib/repositories/MediaRepository'
import type { OrderListFilter } from '../../lib/repositories/OrderRepository'
import { MongoOrderRepository } from '../../lib/repositories/OrderRepository'
import { MongoPageRepository } from '../../lib/repositories/PageRepository'
import { MongoPaymentRepository } from '../../lib/repositories/PaymentRepository'
import { MongoProductRepository } from '../../lib/repositories/ProductRepository'
import type { UserListFilter } from '../../lib/repositories/UserRepository'
import { MongoUserRepository } from '../../lib/repositories/UserRepository'
import * as AdminQueryService from '../../lib/services/AdminQueryService'

interface AdminRepositories {
  productRepository: MongoProductRepository
  categoryRepository: MongoCategoryRepository
  mediaRepository: MongoMediaRepository
  orderRepository: MongoOrderRepository
  userRepository: MongoUserRepository
  pageRepository: MongoPageRepository
  paymentRepository: MongoPaymentRepository
}

const getRepositories = async (): Promise<AdminRepositories> => {
  const connection = await getDbConnection()
  return {
    productRepository: new MongoProductRepository(connection),
    categoryRepository: new MongoCategoryRepository(connection),
    mediaRepository: new MongoMediaRepository(connection),
    orderRepository: new MongoOrderRepository(connection),
    userRepository: new MongoUserRepository(connection),
    pageRepository: new MongoPageRepository(connection),
    paymentRepository: new MongoPaymentRepository(connection),
  }
}

export const listAdminProductsNative = async (filter?: {
  status?: 'draft' | 'published'
  limit?: number
  page?: number
}): Promise<AdminQueryService.AdminProductListRow[]> => {
  const { productRepository } = await getRepositories()
  return AdminQueryService.listAdminProducts({ productRepository }, filter)
}

export const getAdminProductDetailNative = async (
  id: string,
): Promise<AdminQueryService.AdminProductDetail | null> => {
  const { productRepository, categoryRepository } = await getRepositories()
  return AdminQueryService.getAdminProductDetail(id, { productRepository, categoryRepository })
}

export const listAdminCategoriesNative = async (): Promise<
  AdminQueryService.AdminCategoryRow[]
> => {
  const { categoryRepository } = await getRepositories()
  return AdminQueryService.listAdminCategories({ categoryRepository })
}

export const listAdminOrdersNative = async (
  filter?: OrderListFilter,
): Promise<AdminQueryService.AdminOrderListRow[]> => {
  const { orderRepository, userRepository } = await getRepositories()
  return AdminQueryService.listAdminOrders({ orderRepository, userRepository }, filter)
}

export const getAdminOrderDetailNative = async (
  id: string,
): Promise<AdminQueryService.AdminOrderDetail | null> => {
  const { orderRepository, userRepository, paymentRepository } = await getRepositories()
  return AdminQueryService.getAdminOrderDetail(id, {
    orderRepository,
    userRepository,
    paymentRepository,
  })
}

export const listAdminCustomersNative = async (
  filter?: UserListFilter,
): Promise<AdminQueryService.AdminCustomerListRow[]> => {
  const { userRepository } = await getRepositories()
  return AdminQueryService.listAdminCustomers({ userRepository }, filter)
}

export const getAdminCustomerDetailNative = async (
  id: string,
): Promise<AdminQueryService.AdminCustomerDetail | null> => {
  const { userRepository, orderRepository, productRepository } = await getRepositories()
  return AdminQueryService.getAdminCustomerDetail(id, {
    userRepository,
    orderRepository,
    productRepository,
  })
}

export const listAdminPagesNative = async (): Promise<AdminQueryService.AdminPageRow[]> => {
  const { pageRepository } = await getRepositories()
  return AdminQueryService.listAdminPages({ pageRepository })
}

export const getAdminPageDetailNative = async (id: string): Promise<Page | null> => {
  const { pageRepository } = await getRepositories()
  return AdminQueryService.getAdminPageDetail(id, { pageRepository })
}

export const listAdminMediaNative = async (
  limit?: number,
): Promise<AdminQueryService.AdminMediaRow[]> => {
  const { mediaRepository } = await getRepositories()
  return AdminQueryService.listAdminMedia({ mediaRepository }, limit)
}
