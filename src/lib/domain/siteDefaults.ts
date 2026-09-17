// src/lib/domain/siteDefaults.ts
//
// The site's LAST-RESORT defaults for the content that used to be hardcoded
// in `src/app/constants/brand.ts`.
//
// Nothing in the rendering path imports this file directly any more except
// the storefront adapter (`globalsStorefrontAdapter.ts`), which falls back
// to these values field-by-field when the `settings`/`footer` global has
// not been configured yet — the same "null is not an error, and a fresh
// install still renders a coherent site" treatment every other global in
// this codebase already gets (see `Home`'s own doc comment).
//
// `scripts/seed/seedStore.ts` also writes these values into the database
// once, on first seed, so a real deployment starts from real content
// instead of an empty admin screen — but from that point on the DATABASE
// is authoritative, not this file. An operator who edits Settings/Footer
// in `/admin/globals` overrides these permanently; re-running the seed
// script without `SEED_OVERWRITE=true` never touches an edited field.
//
// Every contact detail below — phone numbers, email, both shop addresses,
// Instagram and Facebook handles — was originally transcribed verbatim
// from the client's own supplied promotional flyers (terro-services.jpeg,
// boxed-iphones.jpeg, back-to-school.jpeg and others), not invented. See
// docs/terro-technology-setup.md for the source of each fact.

import type {
  FooterLinkGroup,
  Inclusion,
  SocialLink,
  Testimonial,
} from './types'

export const DEFAULT_SITE_NAME = 'Terro Technology'

export const DEFAULT_SITE_TAGLINE = 'Smartphones and consumer technology, sorted properly'

export const DEFAULT_SITE_DESCRIPTION =
  'Terro Technology sells boxed and preloved smartphones, laptops, gaming PCs and accessories in Harare, and repairs the devices other shops sell you.'

export const DEFAULT_CONTACT = {
  email: 'terrotechnologies@gmail.com',
  phone: '+263 77 381 8274',
  phoneSecondary: '+263 77 555 8702',
  /** Same numbers double as WhatsApp lines on every supplied flyer. */
  whatsapp: '263773818274',
  addressLines: ['Terro Technology', 'Shop No. 9, First Floor, Nhaka Parade', 'Cnr Angwa & George Silundika, Harare'],
  secondAddressLines: ['Terro Technology (2nd counter)', 'Shop 28, Huawei Shop', 'Cnr Angwa & Speke, Harare'],
  /** Not stated on any supplied asset — a placeholder until the client
   * confirms real opening hours. Flagged again in the admin guide. */
  hours: 'Contact us on WhatsApp to confirm today’s hours',
}

export const DEFAULT_SOCIAL_LINKS: SocialLink[] = [
  { platform: 'instagram', label: null, url: 'https://instagram.com/terrotechzw' },
  { platform: 'facebook', label: null, url: 'https://facebook.com/terrotech61' },
  { platform: 'whatsapp', label: null, url: 'https://wa.me/263773818274' },
]

/** The four promises shown above the footer and on the homepage. Every
 * line here is something the supplied flyers actually show Terro doing —
 * "2-year warranty" or "free delivery" are NOT included because no
 * supplied asset states either, and inventing a policy the client has not
 * approved is worse than a shorter, honest list. */
export const DEFAULT_INCLUSIONS: Inclusion[] = [
  {
    title: 'Boxed & preloved stock',
    description: 'New, sealed devices and budget-friendly preloved phones, side by side.',
    icon: 'box',
  },
  {
    title: 'Repairs & accessories',
    description: 'Screens, batteries, covers and computer repairs — not just sales.',
    icon: 'repair',
  },
  {
    title: 'Pay with Paynow',
    description: 'EcoCash, OneMoney, Visa and Mastercard, all secured.',
    icon: 'payment',
  },
  {
    title: 'Message us directly',
    description: 'WhatsApp or call — a person who knows the stock answers.',
    icon: 'message',
  },
]

/** No testimonials have been supplied. Inventing customer quotes for a
 * real, named business is not something this project will do — the
 * `Testimonials` component renders nothing at all when this is empty,
 * which is the correct behaviour until the client supplies real ones. */
export const DEFAULT_TESTIMONIALS: Testimonial[] = []

/** Primary navigation. Seeded once into the Header global (see
 * `seedStore.ts`); from then on `/admin/globals` owns it. Mirrors the five
 * categories the catalogue is actually seeded with — see
 * `scripts/seed/catalogue.ts`. */
export const DEFAULT_PRIMARY_NAV: { label: string; href: string }[] = [
  { label: 'Shop all', href: '/products' },
  { label: 'Smartphones', href: '/products?category=smartphones' },
  { label: 'Laptops & computers', href: '/products?category=laptops-computers' },
  { label: 'Gaming', href: '/products?category=gaming' },
  { label: 'Accessories', href: '/products?category=accessories-parts' },
]

export const DEFAULT_FOOTER_LINK_GROUPS: FooterLinkGroup[] = [
  {
    title: 'Shop',
    links: [
      { label: 'All products', href: '/products' },
      { label: 'Smartphones', href: '/products?category=smartphones' },
      { label: 'Laptops & computers', href: '/products?category=laptops-computers' },
      { label: 'Gaming', href: '/products?category=gaming' },
      { label: 'Accessories & parts', href: '/products?category=accessories-parts' },
    ],
  },
  {
    title: 'Your account',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Create an account', href: '/create-account' },
      { label: 'Orders', href: '/orders' },
      { label: 'Cart', href: '/cart' },
      { label: 'Purchases', href: '/account/purchases' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'Repairs & services', href: '/services' },
      { label: 'Delivery & returns', href: '/delivery-and-returns' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact us', href: '/contact' },
      { label: 'About Terro Technology', href: '/about' },
    ],
  },
]

/** A single generic link shown when the Header global is completely empty
 * (a brand-new install, before the first seed or the first admin edit) —
 * enough that the site is never nav-less, without baking in a specific
 * business's shop categories as a code-level fallback. */
export const MINIMAL_NAV_FALLBACK: { label: string; href: string }[] = [
  { label: 'Shop', href: '/products' },
]
