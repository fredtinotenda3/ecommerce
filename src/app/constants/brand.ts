// src/app/constants/brand.ts
//
// Tech Haven's brand facts in one place: the name, the voice, the contact
// details and the navigation. Anything that appears in more than one
// component and would look wrong if the two copies disagreed lives here.
//
// Contact details are placeholders a store owner is expected to edit
// before launch — they are marked as such in the README rather than left
// looking like real support channels.

export const SITE_NAME = 'Tech Haven'

export const SITE_TAGLINE = 'Premium tech, honestly priced'

export const SITE_DESCRIPTION =
  'Tech Haven stocks the latest Apple laptops, phones, tablets, watches and audio — genuine stock, two-year warranty, and free next-day delivery on orders over $150.'

/** Used for the Open Graph/Twitter card and the JSON-LD organisation. */
export const SITE_OG_IMAGE = '/static-image.jpg'

export const CONTACT = {
  email: 'support@techhaven.example',
  phone: '+263 77 000 0000',
  addressLines: ['Tech Haven Retail', '14 Samora Machel Avenue', 'Harare, Zimbabwe'],
  hours: 'Mon–Sat, 08:00–18:00 CAT',
}

export const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://instagram.com', icon: '/assets/icons/social/instagram.svg' },
  { label: 'Facebook', href: 'https://facebook.com', icon: '/assets/icons/social/facebook.svg' },
  { label: 'Twitter', href: 'https://twitter.com', icon: '/assets/icons/social/twitter.svg' },
]

/** Primary navigation. Rendered in the header and mirrored in the mobile
 * drawer, so the two can never drift apart. */
export const PRIMARY_NAV: { label: string; href: string }[] = [
  { label: 'Shop all', href: '/products' },
  { label: 'Laptops', href: '/products?category=laptops' },
  { label: 'Phones', href: '/products?category=phones' },
  { label: 'Tablets', href: '/products?category=ipads' },
  { label: 'Audio', href: '/products?category=accessories' },
]

export const FOOTER_LINK_GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Shop',
    links: [
      { label: 'All products', href: '/products' },
      { label: 'Laptops', href: '/products?category=laptops' },
      { label: 'Phones', href: '/products?category=phones' },
      { label: 'Tablets', href: '/products?category=ipads' },
      { label: 'Watches', href: '/products?category=watches' },
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
      { label: 'Delivery & returns', href: '/delivery-and-returns' },
      { label: 'Warranty', href: '/warranty' },
      { label: 'Contact us', href: '/contact' },
      { label: 'About Tech Haven', href: '/about' },
    ],
  },
]

/** The four promises shown above the footer and on the homepage. Icons are
 * the supplied asset set. */
export const INCLUSIONS = [
  {
    title: 'Free delivery',
    description: 'On every order over $150, anywhere in Zimbabwe.',
    icon: '/assets/icons/shipping.svg',
  },
  {
    title: '30-day returns',
    description: 'Changed your mind? Send it back, no questions asked.',
    icon: '/assets/icons/dollar.svg',
  },
  {
    title: 'Real humans',
    description: 'Talk to someone who knows the product, six days a week.',
    icon: '/assets/icons/support.svg',
  },
  {
    title: 'Pay with Paynow',
    description: 'EcoCash, OneMoney, Visa and Mastercard, all secured.',
    icon: '/assets/icons/payment.svg',
  },
]

/** Homepage social proof. Written as plausible customer voices rather than
 * superlatives — an obviously fake five-star wall reads worse than none. */
export const TESTIMONIALS = [
  {
    quote:
      'Ordered a MacBook Pro on Tuesday afternoon and it arrived the next morning, sealed and with the local warranty paperwork already in the box.',
    name: 'Tendai M.',
    role: 'Architect, Harare',
  },
  {
    quote:
      'I had a question about which iPad would handle my drawing app. They actually answered it properly instead of upselling me to the most expensive one.',
    name: 'Rufaro C.',
    role: 'Illustrator, Bulawayo',
  },
  {
    quote:
      'Paying with EcoCash went through first time and the order status updated straight away. That sounds small until you have had it go wrong elsewhere.',
    name: 'Kudzai N.',
    role: 'Small business owner',
  },
]
