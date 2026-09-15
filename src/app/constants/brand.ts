// src/app/constants/brand.ts
//
// Terro Technology's brand facts in one place: the name, the voice, the
// contact details and the navigation. Anything that appears in more than
// one component and would look wrong if the two copies disagreed lives
// here.
//
// Every contact detail below — phone numbers, email, both shop addresses,
// Instagram and Facebook handles — is transcribed verbatim from the
// client's own supplied promotional flyers (terro-services.jpeg,
// boxed-iphones.jpeg, back-to-school.jpeg and others), not invented. See
// docs/terro-technology-setup.md for the source of each fact and the small
// number of fields (opening hours, a second WhatsApp line, a public
// storefront domain) the client still needs to confirm.

export const SITE_NAME = 'Terro Technology'

export const SITE_TAGLINE = 'Smartphones and consumer technology, sorted properly'

export const SITE_DESCRIPTION =
  'Terro Technology sells boxed and preloved smartphones, laptops, gaming PCs and accessories in Harare, and repairs the devices other shops sell you.'

/** Used for the Open Graph/Twitter card and the JSON-LD organisation. */
export const SITE_OG_IMAGE = '/brand/og-image.jpg'

/** Two physical counters, both named on the client's own flyers. The first
 * is treated as primary (used in the footer and the JSON-LD address); the
 * second is surfaced on the Contact page. */
export const CONTACT = {
  email: 'terrotechnologies@gmail.com',
  phone: '+263 77 381 8274',
  phoneSecondary: '+263 77 555 8702',
  /** Same numbers double as WhatsApp lines on every supplied flyer. */
  whatsapp: '263773818274',
  addressLines: ['Terro Technology', 'Shop No. 9, First Floor, Nhaka Parade', 'Cnr Angwa & George Silundika, Harare'],
  secondAddressLines: ['Terro Technology (2nd counter)', 'Shop 28, Huawei Shop', 'Cnr Angwa & Speke, Harare'],
  /** Not stated on any supplied asset — a placeholder until the client
   * confirms real opening hours. Flagged again in the setup guide. */
  hours: 'Contact us on WhatsApp to confirm today’s hours',
}

export const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://instagram.com/terrotechzw', icon: '/assets/icons/social/instagram.svg' },
  { label: 'Facebook', href: 'https://facebook.com/terrotech61', icon: '/assets/icons/social/facebook.svg' },
  {
    label: 'WhatsApp',
    href: 'https://wa.me/263773818274',
    icon: '/assets/icons/social/whatsapp.svg',
  },
]

/** Primary navigation. Rendered in the header and mirrored in the mobile
 * drawer, so the two can never drift apart. Mirrors the five categories
 * the catalogue is actually seeded with — see scripts/seed/catalogue.ts. */
export const PRIMARY_NAV: { label: string; href: string }[] = [
  { label: 'Shop all', href: '/products' },
  { label: 'Smartphones', href: '/products?category=smartphones' },
  { label: 'Laptops & computers', href: '/products?category=laptops-computers' },
  { label: 'Gaming', href: '/products?category=gaming' },
  { label: 'Accessories', href: '/products?category=accessories-parts' },
]

export const FOOTER_LINK_GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
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

/** The four promises shown above the footer and on the homepage. Every
 * line here is something the supplied flyers actually show Terro doing —
 * "2-year warranty" or "free delivery" are NOT included because no
 * supplied asset states either, and inventing a policy the client has not
 * approved is worse than a shorter, honest list. */
export const INCLUSIONS = [
  {
    title: 'Boxed & preloved stock',
    description: 'New, sealed devices and budget-friendly preloved phones, side by side.',
    icon: '/assets/icons/shipping.svg',
  },
  {
    title: 'Repairs & accessories',
    description: 'Screens, batteries, covers and computer repairs — not just sales.',
    icon: '/assets/icons/support.svg',
  },
  {
    title: 'Pay with Paynow',
    description: 'EcoCash, OneMoney, Visa and Mastercard, all secured.',
    icon: '/assets/icons/payment.svg',
  },
  {
    title: 'Message us directly',
    description: 'WhatsApp or call — a person who knows the stock answers.',
    icon: '/assets/icons/dollar.svg',
  },
]

/** No testimonials have been supplied. Inventing customer quotes for a
 * real, named business is not something this project will do — the
 * `Testimonials` component renders nothing at all when this is empty,
 * which is the correct behaviour until the client supplies real ones. */
export const TESTIMONIALS: { quote: string; name: string; role: string }[] = []
