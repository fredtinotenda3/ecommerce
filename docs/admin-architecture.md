# Planned Native Admin — Route Boundaries

**Status: planning document only.** No admin UI is built in Phase 1. Payload's
existing admin at `/admin` remains the live, only admin dashboard until a
future phase explicitly replaces it (see the audit's Phased Implementation
Plan, Phase 6).

This document exists so the repository/service layer built in Phase 1
(`ProductRepository`, `OrderRepository`, `CategoryRepository`, `PageRepository`,
`MediaRepository`, plus the corresponding services) is shaped around the
admin surface it will eventually need to serve, rather than being designed
in a vacuum and reshaped later.

Scope is intentionally bounded to what the audit found actually in use
today — see `MIGRATION-AUDIT.md`, "Admin Audit" section — not a hypothetical
superset of ecommerce-admin features.

## Planned routes

| Route | Purpose | Backed by (Phase 1 services) |
|---|---|---|
| `/admin/products` | List/search products | `ProductService.listPublished` (extended later with a draft+published admin list variant) |
| `/admin/products/[id]` | Create/edit a product: title, **price + currency**, categories, images, block content, SEO, paywall toggle | `ProductService.setPrice`, `ProductRepository.update` |
| `/admin/categories` | CRUD + parent selection | `CategoryRepository` |
| `/admin/orders` | List orders, filter by status | `OrderRepository.getByCustomer` / a future `list()` method |
| `/admin/orders/[id]` | Order detail: customer, items, totals, payment status/reference | `OrderService.getById` + `PaymentRepository.getByOrderId` |
| `/admin/customers` | List/search customers | `UserRepository` (read paths only; no admin mutation planned beyond role assignment) |
| `/admin/customers/[id]` | Customer detail: account info, orders, purchases | `UserRepository.getById` + `OrderService.getByCustomer` |
| `/admin/pages` | CMS Pages CRUD, block editor | `PageRepository` |
| `/admin/media` | Media library: upload, browse, alt text | `MediaRepository` |
| `/admin/settings` | Site settings, Header, Footer singleton editors | Not yet modeled as a repository — Settings/Header/Footer globals need a small dedicated repository in a later phase, deliberately out of scope for Phase 1 since nothing else depends on it yet |
| `/admin/users` | Admin user management, role assignment | `UserRepository` + `src/lib/auth/roles.ts` (`assertHasRole`) |

## Authorization boundary

Every `/admin/**` route will require `roles.includes('admin')` — checked
server-side (route handler / Server Component), never trusted from the
client. This mirrors Payload's existing `checkRole(['admin'], user)` pattern
identified in the audit, so the authorization *semantics* are not changing,
only *where* they're enforced (service/route layer vs. Payload's
`access.admin` collection config).

## Explicitly not planned (not found in current usage)

Per the audit, no evidence was found of: bulk admin actions, CSV export,
multi-warehouse inventory, discount codes, or multi-currency admin UI. These
are not modeled in the Phase 1 repository/service layer and should not be
assumed as future scope without a separate business decision.
