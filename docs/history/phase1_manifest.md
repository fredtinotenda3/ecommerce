# PHASE 1 DELIVERY — FILE MANIFEST

Zip: `phase1_changes.zip`
Patch: `phase1.patch` (unified diff, same content, alternate format)

All paths are relative to the repository root (`ecommerce-main/`).
2 modified, 45 new. Nothing else in the repository was touched.

## Modified (2)

- `.gitignore` — added `node_modules/`, `.next/`, `scripts/migrations/reports/`, `*.log` (baseline had no `.gitignore`; this is additive, no existing ignore rules removed since there were none)
- `package.json` — additive only: 3 new scripts (`test`, `test:watch`, `migration:products:prices`), 1 new dependency (`mongoose`, pinned to the version already resolved transitively via `@payloadcms/db-mongodb`, so no new install is required for existing functionality), 1 new devDependency (`vitest`). No existing script, dependency, or devDependency was changed or removed.

## New — documentation (1)

- `docs/admin-architecture.md`

## New — migration tooling (2)

- `scripts/migrations/lib/migrationRunner.ts`
- `scripts/migrations/backfillProductPrices.ts`

## New — native db layer (10)

- `src/lib/db/connection.ts`
- `src/lib/db/models/getOrCreateModel.ts`
- `src/lib/db/models/Product.ts`
- `src/lib/db/models/Category.ts`
- `src/lib/db/models/Page.ts`
- `src/lib/db/models/Media.ts`
- `src/lib/db/models/User.ts`
- `src/lib/db/models/Order.ts`
- `src/lib/db/models/Payment.ts`
- `src/lib/db/models/PaymentAttempt.ts`

## New — domain layer (2)

- `src/lib/domain/types.ts`
- `src/lib/domain/money.ts`

## New — repository layer (7)

- `src/lib/repositories/ProductRepository.ts`
- `src/lib/repositories/CategoryRepository.ts`
- `src/lib/repositories/PageRepository.ts`
- `src/lib/repositories/MediaRepository.ts`
- `src/lib/repositories/UserRepository.ts`
- `src/lib/repositories/OrderRepository.ts`
- `src/lib/repositories/PaymentRepository.ts`

## New — service layer (6)

- `src/lib/services/pricing.ts`
- `src/lib/services/orderStateMachine.ts`
- `src/lib/services/ProductService.ts`
- `src/lib/services/OrderService.ts`
- `src/lib/services/PaymentService.ts`
- `src/lib/services/CartService.ts`

## New — payment provider abstraction (1)

- `src/lib/payments/PaymentProvider.ts`

## New — auth foundation (3, not wired into any route)

- `src/lib/auth/password.ts`
- `src/lib/auth/session.ts`
- `src/lib/auth/roles.ts`

## New — tests (13)

- `vitest.config.ts`
- `tests/money.test.ts`
- `tests/pricing.test.ts`
- `tests/stateMachine.test.ts`
- `tests/orderService.test.ts`
- `tests/paymentService.test.ts`
- `tests/cartService.test.ts`
- `tests/productService.test.ts`
- `tests/auth.test.ts`
- `tests/fakes/FakeProductRepository.ts`
- `tests/fakes/FakeOrderRepository.ts`
- `tests/fakes/FakePaymentRepository.ts`
- `tests/fakes/FakePaymentProvider.ts`

**Total: 47 files touched (2 modified + 45 new).**

Nothing under `src/payload/`, `src/app/`, `src/server.ts`, or any existing
route, component, collection, hook, or endpoint was created, modified, or
deleted. `package-lock.json`/`yarn.lock` are unchanged (mongoose is already
satisfied transitively at the pinned version; vitest is newly declared but
not yet installed — see Implementation Report, "Validation").
