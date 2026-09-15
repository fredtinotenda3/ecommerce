// A dead `inclusions` export used to live here (Free Shipping "above $150",
// a 30-day "Money Guarantee", 24/7 support) — leftover scaffold content,
// unused anywhere in the app, and every claim in it is exactly the kind of
// invented delivery/guarantee promise the Terro Technology brief rules out.
// The trust claims actually rendered on the storefront live in
// `constants/brand.ts` (`INCLUSIONS`), sourced from the client's own
// supplied material. Removed rather than rebranded, since nothing referenced
// it.

export const profileNavItems = [
  {
    title: 'Personal Information',
    url: '/account',
    icon: '/assets/icons/user.svg',
  },
  {
    title: 'My Purchases',
    url: '/account/purchases',
    icon: '/assets/icons/purchases.svg',
  },
  {
    title: 'My Orders',
    url: '/account/orders',
    icon: '/assets/icons/orders.svg',
  },
  {
    title: 'Logout',
    url: '/logout',
    icon: '/assets/icons/logout.svg',
  },
]

export const noHeaderFooterUrls = ['/create-account', '/login', '/recover-password']
