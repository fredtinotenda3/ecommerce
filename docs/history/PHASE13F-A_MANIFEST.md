# PHASE 13F-A MANIFEST

## New files (4)
- src/lib/payments/StripeProvider.ts
- src/lib/services/StripeOrderService.ts
- src/app/api/orders/native/route.ts
- tests/stripeOrderService.test.ts

## Modified files (11)
- src/lib/repositories/PaymentRepository.ts
- src/lib/services/PaymentService.ts
- src/lib/services/StripeWebhookService.ts
- src/app/_api/stripeCheckoutNative.ts
- src/app/api/payments/stripe/webhook/route.ts
- src/app/(pages)/checkout/CheckoutPage/index.tsx
- src/app/(pages)/checkout/CheckoutForm/index.tsx
- scripts/validation/checkFlags.ts
- tests/fakes/FakePaymentRepository.ts
- tests/paymentService.test.ts
- tests/stripeWebhookService.test.ts

## Deleted files
None.

## Untouched (confirmed)
- src/payload/endpoints/create-payment-intent.ts
- src/payload/stripe/webhooks/*
- payload.config.ts's stripePlugin(...) registration
- src/lib/services/StripeCheckoutService.ts (Phase 13E, unchanged)
- src/app/api/checkout/stripe/create-payment-intent/route.ts (Phase 13E, unchanged)
