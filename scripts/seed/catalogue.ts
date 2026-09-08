// scripts/seed/catalogue.ts
//
// The Tech Haven demo catalogue as plain data: media records, categories
// and products.
//
// Kept apart from `seedStore.ts` so the writing logic and the content can
// be reviewed independently, and so a store owner replacing the demo
// catalogue with their own only has to edit this file.
//
// Prices are integers in minor units (cents) with an explicit ISO currency
// code, matching `src/lib/domain/money.ts` — the storefront never sees a
// float. `compareAtPrice`, when present, is the "was" price a sale badge is
// derived from and must be strictly greater than `price`; `seedStore.ts`
// asserts that rather than trusting this file.
//
// Image dimensions are recorded here because they are written to the media
// documents, and `next/image` needs them to reserve layout space before the
// bytes arrive. They were read from the files themselves, not estimated.

export interface SeedMedia {
  filename: string
  alt: string
  width: number
  height: number
}

export interface SeedCategory {
  title: string
  /** Stable slug used by navigation links; stored on the document so the
   * products page can map `?category=laptops` onto an id. */
  slug: string
  description: string
  media: string
}

export interface SeedProduct {
  slug: string
  title: string
  description: string
  /** Longer body copy rendered on the product page. One paragraph per entry. */
  body: string[]
  price: number
  compareAtPrice?: number
  currency: string
  categorySlug: string
  media: string
  /** Slugs of products shown under "You might also like". Resolved to ids
   * after every product has been written. */
  related: string[]
}

export const SEED_CURRENCY = 'USD'

export const SEED_MEDIA: SeedMedia[] = [
  // --- Category imagery -----------------------------------------------
  {
    filename: 'laptops-category.png',
    alt: 'A MacBook open on a desk, seen from a low angle',
    width: 620,
    height: 720,
  },
  {
    filename: 'phones-category.png',
    alt: 'Two iPhones standing back to back',
    width: 620,
    height: 720,
  },
  {
    filename: 'ipads-category.png',
    alt: 'An iPad Pro with the Apple Pencil resting beside it',
    width: 620,
    height: 720,
  },
  {
    filename: 'watches-category.png',
    alt: 'An Apple Watch showing its always-on display',
    width: 620,
    height: 720,
  },
  {
    filename: 'tv-home-category.png',
    alt: 'An Apple TV box with its remote on a media unit',
    width: 620,
    height: 720,
  },
  {
    filename: 'accessories-category.png',
    alt: 'AirPods and a charging cable arranged on a plain background',
    width: 620,
    height: 720,
  },

  // --- Product imagery -------------------------------------------------
  {
    filename: '13-inch-macbokk-air-256gb-space-gray.png',
    alt: '13-inch MacBook Air in space grey, open at an angle',
    width: 1870,
    height: 1190,
  },
  {
    filename: '15-inch-macbook-air-2tb-midnight.png',
    alt: '15-inch MacBook Air in midnight, open and facing forward',
    width: 1914,
    height: 1190,
  },
  {
    filename: '14-inch-macbook-pro-12-core-1tb-space-black.png',
    alt: '14-inch MacBook Pro in space black, open at an angle',
    width: 1914,
    height: 1148,
  },
  {
    filename: 'apple-iphone-15-pro-1tb-blue-titanium.png',
    alt: 'iPhone 15 Pro in blue titanium, front and back',
    width: 852,
    height: 986,
  },
  {
    filename: 'apple-iphone-15-pro-max-256gb-natural-titanium.png',
    alt: 'iPhone 15 Pro Max in natural titanium, front and back',
    width: 758,
    height: 1038,
  },
  {
    filename: 'apple-iphone-14-128gb-blue.png',
    alt: 'iPhone 14 in blue, front and back',
    width: 824,
    height: 1090,
  },
  {
    filename: '11-inch-ipad-pro-512gb-space-gray.png',
    alt: '11-inch iPad Pro in space grey with the Magic Keyboard',
    width: 942,
    height: 1058,
  },
  {
    filename: 'apple-ipad-air-256gb-purple.png',
    alt: 'iPad Air in purple, shown from the front',
    width: 950,
    height: 1060,
  },
  {
    filename: 'apple-watch-series-9-aluminum.png',
    alt: 'Apple Watch Series 9 in aluminium with a sport band',
    width: 930,
    height: 1072,
  },
  {
    filename: 'apple-watch-ultra-2.png',
    alt: 'Apple Watch Ultra 2 with the alpine loop band',
    width: 944,
    height: 1034,
  },
  {
    filename: 'airpods-pro-2nd-generation.png',
    alt: 'AirPods Pro second generation in their charging case',
    width: 744,
    height: 918,
  },
  {
    filename: 'airpods-max.png',
    alt: 'AirPods Max over-ear headphones',
    width: 1058,
    height: 1110,
  },
  {
    filename: 'apple-tv-4k-wifi.png',
    alt: 'Apple TV 4K with the Siri Remote',
    width: 1104,
    height: 1052,
  },
  {
    filename: 'apple-pencil-1st-generation.png',
    alt: 'Apple Pencil first generation, shown horizontally',
    width: 1720,
    height: 580,
  },
  {
    filename: 'silver-lamicall-adjustable-laptop-riser.png',
    alt: 'A silver adjustable aluminium laptop riser',
    width: 1132,
    height: 1314,
  },
]

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    title: 'Laptops',
    slug: 'laptops',
    description: 'MacBook Air and MacBook Pro, configured and ready to collect or deliver.',
    media: 'laptops-category.png',
  },
  {
    title: 'Phones',
    slug: 'phones',
    description: 'Current-generation iPhones, unlocked and network-free.',
    media: 'phones-category.png',
  },
  {
    title: 'iPads',
    slug: 'ipads',
    description: 'iPad Pro and iPad Air, with the accessories that make them useful.',
    media: 'ipads-category.png',
  },
  {
    title: 'Watches',
    slug: 'watches',
    description: 'Apple Watch for everyday wear and for the days that ask more of it.',
    media: 'watches-category.png',
  },
  {
    title: 'TV & Home',
    slug: 'tv-home',
    description: 'Apple TV and the pieces that tie a living room together.',
    media: 'tv-home-category.png',
  },
  {
    title: 'Accessories',
    slug: 'accessories',
    description: 'Audio, styluses and stands — the things you notice every day.',
    media: 'accessories-category.png',
  },
]

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    slug: '13-inch-macbook-air-256gb-space-gray',
    title: '13-inch MacBook Air, 256GB, Space Grey',
    description:
      'The laptop most people should buy: silent, cool, and good for a full day away from a plug.',
    body: [
      'The 13-inch MacBook Air has no fan, which means it makes no noise at all — not while you edit a spreadsheet, and not while it installs updates in the background. Apple silicon is efficient enough that it does not need one.',
      'A full charge covers a working day and the trip home. The 256GB configuration suits anyone who keeps documents and photos in the cloud; if you edit video or keep large local libraries, look at the 15-inch or the Pro.',
      'Every unit is sealed stock with a two-year Tech Haven warranty on top of the manufacturer cover.',
    ],
    price: 109900,
    compareAtPrice: 124900,
    currency: SEED_CURRENCY,
    categorySlug: 'laptops',
    media: '13-inch-macbokk-air-256gb-space-gray.png',
    related: ['15-inch-macbook-air-2tb-midnight', 'silver-lamicall-adjustable-laptop-riser'],
  },
  {
    slug: '15-inch-macbook-air-2tb-midnight',
    title: '15-inch MacBook Air, 2TB, Midnight',
    description:
      'The same silent machine with room to spread out — a bigger display, better speakers, more storage.',
    body: [
      'The 15-inch Air is the answer to the one complaint people had about the 13: not enough screen. You get a noticeably larger display and a six-speaker system, in a body that is still thin enough to forget in a bag.',
      'At 2TB this is a genuine desktop replacement. Local photo libraries, virtual machines and years of project files all fit without an external drive.',
      'Midnight is a dark blue that reads almost black indoors. It shows fingerprints; a cloth is included.',
    ],
    price: 219900,
    currency: SEED_CURRENCY,
    categorySlug: 'laptops',
    media: '15-inch-macbook-air-2tb-midnight.png',
    related: ['13-inch-macbook-air-256gb-space-gray', '14-inch-macbook-pro-12-core-1tb-space-black'],
  },
  {
    slug: '14-inch-macbook-pro-12-core-1tb-space-black',
    title: '14-inch MacBook Pro, 12-core, 1TB, Space Black',
    description:
      'For sustained work: a display that holds its brightness, ports that mean no dongles, and a fan that only runs when it has to.',
    body: [
      'The Pro exists for work that runs for hours rather than minutes — video exports, large builds, colour-critical retouching. The mini-LED display holds its brightness under load, and the 12-core configuration keeps a long render from throttling the machine.',
      'HDMI, an SD card slot and three Thunderbolt ports come back on this model, which is the practical reason most photographers and editors choose it over the Air.',
      'Space Black is a darker finish with an anodisation that resists fingerprints far better than the previous grey.',
    ],
    price: 279900,
    compareAtPrice: 299900,
    currency: SEED_CURRENCY,
    categorySlug: 'laptops',
    media: '14-inch-macbook-pro-12-core-1tb-space-black.png',
    related: ['15-inch-macbook-air-2tb-midnight', 'silver-lamicall-adjustable-laptop-riser'],
  },
  {
    slug: 'iphone-15-pro-1tb-blue-titanium',
    title: 'iPhone 15 Pro, 1TB, Blue Titanium',
    description:
      'Titanium rather than steel, so it is lighter in the hand than the numbers suggest. USB-C at last.',
    body: [
      'The move to titanium took real weight out of the Pro without making it feel hollow. If you have been carrying a 13 or 14 Pro, the difference is obvious within a day.',
      'USB-C means one cable for the phone, the iPad and the MacBook. At 1TB you can shoot ProRes video directly to the phone rather than to an external drive.',
      'Sold unlocked and network-free. Works with EcoCash-funded Paynow payments at checkout.',
    ],
    price: 159900,
    currency: SEED_CURRENCY,
    categorySlug: 'phones',
    media: 'apple-iphone-15-pro-1tb-blue-titanium.png',
    related: ['iphone-15-pro-max-256gb-natural-titanium', 'airpods-pro-2nd-generation'],
  },
  {
    slug: 'iphone-15-pro-max-256gb-natural-titanium',
    title: 'iPhone 15 Pro Max, 256GB, Natural Titanium',
    description: 'The longest battery life in the range, and the only iPhone with the 5x telephoto.',
    body: [
      'The Max earns its size two ways: it lasts longer than any other iPhone on a charge, and it is the only model with the 5x telephoto camera. If you photograph anything at a distance — sport, wildlife, stage — that lens is the reason to choose this one.',
      'Natural titanium is the raw brushed finish. It marks less than the polished colours and does not show a case line.',
      '256GB is the sensible middle: enough for a large photo library without paying for storage you will not fill.',
    ],
    price: 139900,
    compareAtPrice: 149900,
    currency: SEED_CURRENCY,
    categorySlug: 'phones',
    media: 'apple-iphone-15-pro-max-256gb-natural-titanium.png',
    related: ['iphone-15-pro-1tb-blue-titanium', 'apple-watch-series-9-aluminum'],
  },
  {
    slug: 'iphone-14-128gb-blue',
    title: 'iPhone 14, 128GB, Blue',
    description:
      'Still an excellent phone, and now the best value in the range. Ideal as a first iPhone.',
    body: [
      'The 14 does everything most people need a phone to do, and it does it for considerably less than the current Pro. The camera is very good, the battery comfortably lasts a day, and it will keep receiving software updates for years yet.',
      'This is the phone we recommend for a first iPhone, a work handset, or anyone replacing something older than an 11.',
      '128GB with iCloud Photos is enough for most people. New, sealed, unlocked.',
    ],
    price: 69900,
    compareAtPrice: 79900,
    currency: SEED_CURRENCY,
    categorySlug: 'phones',
    media: 'apple-iphone-14-128gb-blue.png',
    related: ['iphone-15-pro-max-256gb-natural-titanium', 'airpods-pro-2nd-generation'],
  },
  {
    slug: '11-inch-ipad-pro-512gb-space-gray',
    title: '11-inch iPad Pro, 512GB, Space Grey',
    description:
      'The tablet that replaces a laptop for some people — and is honest about not replacing it for everyone.',
    body: [
      'The 11-inch Pro is fast enough to edit multi-track video and colour-grade RAW photographs, and light enough to hold one-handed while sketching. With the Magic Keyboard it does most of what a laptop does.',
      'It does not run desktop applications, and file management is still more constrained than macOS. If your work depends on either, buy an Air instead — we would rather tell you that now.',
      '512GB is the right size if you work with video or large scanned documents locally.',
    ],
    price: 129900,
    currency: SEED_CURRENCY,
    categorySlug: 'ipads',
    media: '11-inch-ipad-pro-512gb-space-gray.png',
    related: ['ipad-air-256gb-purple', 'apple-pencil-1st-generation'],
  },
  {
    slug: 'ipad-air-256gb-purple',
    title: 'iPad Air, 256GB, Purple',
    description:
      'Most of the Pro, for meaningfully less. The one to buy for reading, drawing and everything in between.',
    body: [
      'The Air runs the same drawing and note-taking apps as the Pro at the same speed for all but the heaviest work. Unless you need the Pro display or the extra cameras, this is the better purchase.',
      '256GB suits an illustrator keeping working files on-device, or a student with several years of annotated PDFs.',
      'The purple is a soft matte finish rather than a bright one — it looks considered rather than loud.',
    ],
    price: 79900,
    compareAtPrice: 89900,
    currency: SEED_CURRENCY,
    categorySlug: 'ipads',
    media: 'apple-ipad-air-256gb-purple.png',
    related: ['11-inch-ipad-pro-512gb-space-gray', 'apple-pencil-1st-generation'],
  },
  {
    slug: 'apple-watch-series-9-aluminum',
    title: 'Apple Watch Series 9, Aluminium',
    description:
      'The everyday Apple Watch: bright always-on display, reliable fitness tracking, charges in under an hour.',
    body: [
      'Series 9 is the watch for ordinary days — notifications, workouts, sleep, and paying for things without reaching for a phone. The always-on display is legible in direct sunlight, which is not a small thing here.',
      'Aluminium is lighter than stainless steel and takes knocks better than it looks like it should. A full charge takes well under an hour.',
      'Choose a band size at checkout; we will swap it free within 30 days if you pick wrong.',
    ],
    price: 39900,
    currency: SEED_CURRENCY,
    categorySlug: 'watches',
    media: 'apple-watch-series-9-aluminum.png',
    related: ['apple-watch-ultra-2', 'iphone-15-pro-max-256gb-natural-titanium'],
  },
  {
    slug: 'apple-watch-ultra-2',
    title: 'Apple Watch Ultra 2',
    description:
      'Two to three days of battery, a display you can read in full sun, and a case built to be knocked about.',
    body: [
      'The Ultra is for people who are outdoors for long stretches: hikers, divers, anyone who resents charging a watch nightly. It runs for two to three days of normal use, longer with the low-power setting.',
      'The titanium case takes impacts that would mark an aluminium watch, and the display is the brightest Apple makes — genuinely readable at midday.',
      'It is large. Try one on before committing if you have narrow wrists; we keep demo units in store.',
    ],
    price: 89900,
    compareAtPrice: 99900,
    currency: SEED_CURRENCY,
    categorySlug: 'watches',
    media: 'apple-watch-ultra-2.png',
    related: ['apple-watch-series-9-aluminum', 'iphone-15-pro-1tb-blue-titanium'],
  },
  {
    slug: 'apple-tv-4k-wifi',
    title: 'Apple TV 4K (Wi-Fi)',
    description:
      'The fastest way to make an ageing smart TV pleasant to use again. No advertising on the home screen.',
    body: [
      'Most televisions have software that gets slower every year and fills the home screen with promotions. Apple TV 4K replaces it with something quick that stays out of the way.',
      'It handles 4K HDR and Dolby Atmos, and the remote is the one part of the box people comment on unprompted — it has a proper directional pad and it is hard to lose down a sofa.',
      'The Wi-Fi model is right for most homes; ask us about the Ethernet model if you stream at the top bitrates.',
    ],
    price: 14900,
    currency: SEED_CURRENCY,
    categorySlug: 'tv-home',
    media: 'apple-tv-4k-wifi.png',
    related: ['airpods-max', 'airpods-pro-2nd-generation'],
  },
  {
    slug: 'airpods-pro-2nd-generation',
    title: 'AirPods Pro (2nd generation)',
    description:
      'Noise cancellation that actually works on a bus, and a transparency mode you will use more than you expect.',
    body: [
      'The second-generation Pro roughly doubled the noise cancellation of the first, and the difference is most obvious in exactly the places you want it: traffic, aircraft, open-plan offices.',
      'Transparency mode passes outside sound through so cleanly that most people leave them in during conversations. Four ear-tip sizes are in the box.',
      'The case can be tracked with Find My and charges over USB-C or on a Qi mat.',
    ],
    price: 24900,
    compareAtPrice: 27900,
    currency: SEED_CURRENCY,
    categorySlug: 'accessories',
    media: 'airpods-pro-2nd-generation.png',
    related: ['airpods-max', 'iphone-14-128gb-blue'],
  },
  {
    slug: 'airpods-max',
    title: 'AirPods Max',
    description:
      'Over-ear headphones with a memory-foam fit you can wear for a working day. Heavy, and worth it for the sound.',
    body: [
      'AirPods Max are the ones to buy if you listen for hours at a time. The mesh canopy and memory-foam cushions spread the weight well enough that a full day is comfortable.',
      'They are heavier than plastic competitors because the frame is stainless steel and aluminium. That is also why they sound better and will outlast them.',
      'The included case is a soft cover rather than a hard shell — budget for a proper case if they live in a rucksack.',
    ],
    price: 54900,
    currency: SEED_CURRENCY,
    categorySlug: 'accessories',
    media: 'airpods-max.png',
    related: ['airpods-pro-2nd-generation', 'apple-tv-4k-wifi'],
  },
  {
    slug: 'apple-pencil-1st-generation',
    title: 'Apple Pencil (1st generation)',
    description:
      'The stylus for the iPads that take it. Check compatibility below before you order — the generations are not interchangeable.',
    body: [
      'The first-generation Pencil pairs and charges through a Lightning connector, which means it works with older iPads and the entry-level model, and does NOT work with the iPad Pro or iPad Air sold on this page.',
      'Pressure and tilt sensitivity are unchanged from the second generation; what you lose is magnetic attachment and the double-tap gesture.',
      'If you are buying for an iPad Pro or Air, tell us at checkout and we will swap it for the correct generation before the order ships.',
    ],
    price: 9900,
    currency: SEED_CURRENCY,
    categorySlug: 'accessories',
    media: 'apple-pencil-1st-generation.png',
    related: ['ipad-air-256gb-purple', '11-inch-ipad-pro-512gb-space-gray'],
  },
  {
    slug: 'silver-lamicall-adjustable-laptop-riser',
    title: 'Lamicall Adjustable Laptop Riser, Silver',
    description:
      'Aluminium stand that puts the screen at eye level. The cheapest thing here that will change your working day.',
    body: [
      'A laptop on a desk puts the screen roughly a foot below where your neck wants it. A riser and an external keyboard fix that for less than the cost of a single physiotherapy session.',
      'This one is machined aluminium rather than folded steel, so it does not flex when you type, and it holds machines up to 16 inches without the front lip covering any ports.',
      'Folds flat enough to travel in a laptop bag.',
    ],
    price: 4900,
    compareAtPrice: 6500,
    currency: SEED_CURRENCY,
    categorySlug: 'accessories',
    media: 'silver-lamicall-adjustable-laptop-riser.png',
    related: ['13-inch-macbook-air-256gb-space-gray', '14-inch-macbook-pro-12-core-1tb-space-black'],
  },
]
