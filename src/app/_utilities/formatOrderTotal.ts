// src/app/_utilities/formatOrderTotal.ts
//
// Formats an order's stored total for display. The amount is an integer in
// the order's own currency's minor units, frozen at order-creation time —
// see src/lib/domain/money.ts for why money is never held as a float.

import { formatMoney } from '../../lib/domain/money'

export const formatOrderTotal = (order: { total: number; currency: string }): string =>
  formatMoney({ amount: order.total, currency: order.currency })
