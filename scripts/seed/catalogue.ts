// scripts/seed/catalogue.ts
//
// The Terro Technology starter catalogue as plain data: media records,
// categories and products.
//
// Kept apart from `seedStore.ts` so the writing logic and the content can
// be reviewed independently, and so Terro can replace this catalogue with
// their own without touching the writer.
//
// Every image referenced below is a supplied Terro Technology asset —
// cropped to remove the client's own baked-in flyer text, prices and
// contact details, never upscaled, never a stock substitute. Exactly which
// source file each one came from, and why, is recorded in
// docs/image-polish-prompts.md. Two categories of number in this file need
// the client's confirmation before launch, and both are called out again in
// docs/terro-technology-setup.md:
//
//   - Prices marked "sourced from the client's own flyer" are transcribed
//     verbatim from boxed-iphones.jpeg / brand-new-samsung.jpeg and are
//     only as current as those flyers are.
//   - Prices marked "ESTIMATED" have no supporting document at all (Huawei
//     was shown with no price attached to any flyer, and nothing prices a
//     custom PC build, a printer or a spare part) and are placed at a
//     plausible Zimbabwe retail level for their category, not derived from
//     anything Terro provided. Ship nothing to a paying customer on an
//     estimated price without checking it first.
//
// Prices are integers in minor units (cents) with an explicit ISO currency
// code, matching `src/lib/domain/money.ts` — the storefront never sees a
// float. No product below carries a `compareAtPrice`: a "was" price is a
// specific claim about a previous price, and nothing supplied states one —
// inventing one would be exactly the fabricated discount the client's brief
// says not to ship.
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
   * products page can map `?category=smartphones` onto an id. */
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
  // --- Category imagery -------------------------------------------------
  // Cropped from the client's own promotional flyers with every price,
  // phone number and headline removed — see docs/image-polish-prompts.md
  // for the exact source file and crop for each one.
  {
    filename: 'category-smartphones.jpg',
    alt: 'A Huawei, a Samsung Galaxy Ultra and an iPhone standing side by side, cameras facing the viewer',
    width: 460,
    height: 280,
  },
  {
    filename: 'category-laptops.jpg',
    alt: 'A MacBook opened for repair, its logic board and battery removed and laid out beside it',
    width: 1080,
    height: 1080,
  },
  {
    filename: 'category-gaming.jpg',
    alt: 'A custom gaming PC with a tempered-glass side panel and red interior lighting, beside its monitor and keyboard',
    width: 1080,
    height: 524,
  },
  {
    filename: 'category-accessories.jpg',
    alt: 'A laptop screen, several chargers, batteries and SSDs arranged together',
    width: 746,
    height: 567,
  },
  {
    filename: 'category-office-tech.jpg',
    alt: 'Three home and office printers of different sizes standing together',
    width: 800,
    height: 578,
  },

  // --- Product imagery ---------------------------------------------------
  {
    filename: 'products/apple-iphone-15-pro-256gb-natural-titanium.jpg',
    alt: 'iPhone 15 Pro in natural titanium, shown from the front and the back',
    width: 603,
    height: 885,
  },
  {
    filename: 'products/samsung-galaxy-s23-ultra-256gb-green.jpg',
    alt: 'Samsung Galaxy S23 Ultra in green, showing its rear camera array',
    width: 393,
    height: 885,
  },
  {
    filename: 'products/huawei-p60-pro-256gb-black.jpg',
    alt: 'Huawei P60 Pro in black, showing its circular rear camera module',
    width: 372,
    height: 885,
  },
  {
    filename: 'products/preloved-iphone-x-64gb.jpg',
    alt: 'A preloved iPhone X, screen on, shown at an angle',
    width: 454,
    height: 1038,
  },
  // The one gaming PC product reuses the category's own media entry
  // (`category-gaming.jpg`, declared above) rather than duplicating it here
  // — it is genuinely the same photo of the same build, not two different
  // assets that happen to look alike.
  {
    filename: 'products/laptop-ssd-128-512gb.jpg',
    alt: '128GB, 256GB and 512GB solid state drives standing together',
    width: 756,
    height: 378,
  },
  {
    filename: 'products/home-office-inkjet-printer.jpg',
    alt: 'A Canon home and office inkjet printer, printing a colour photo',
    width: 820,
    height: 582,
  },
  {
    filename: 'products/universal-laptop-charger.jpg',
    alt: 'An assortment of laptop chargers from different brands',
    width: 692,
    height: 366,
  },

  // --- Content-page hero imagery -----------------------------------------
  // Neither page's copy makes a claim these support beyond what they show
  // on their face — a repair bench and an opened Apple all-in-one — see
  // docs/image-polish-prompts.md for the source flyer each was cropped
  // from (computer-fix.jpeg and mac-inside-screen.jpeg) and why each was
  // judged watermark-free and safe to use.
  {
    filename: 'warranty-repair-bench.jpg',
    alt: 'A technician’s hands working on an opened laptop and a bare motherboard on a repair bench, with a screwdriver and multimeter alongside',
    width: 1080,
    height: 479,
  },
  {
    filename: 'about-repair-detail.jpg',
    alt: 'The rear panel of an all-in-one desktop computer removed, showing its internal motherboard, fans and speakers',
    width: 1080,
    height: 1080,
  },
]

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    title: 'Smartphones',
    slug: 'smartphones',
    description:
      'Boxed and preloved iPhones, Samsung Galaxy and Huawei — new stock and budget-friendly used devices, side by side.',
    media: 'category-smartphones.jpg',
  },
  {
    title: 'Laptops & Computers',
    // toCategorySlug('Laptops & Computers') === 'laptops-computers' —
    // validateCatalogue() checks this derivation exactly, so the slug here
    // and the `?category=` links in constants/brand.ts must both match it.
    slug: 'laptops-computers',
    description:
      'Laptop sales, upgrades and repair. Photographed listings are on their way — see the note on this page.',
    media: 'category-laptops.jpg',
  },
  {
    title: 'Gaming',
    slug: 'gaming',
    description: 'Custom-built gaming PCs, configured to a budget rather than sold off a shelf.',
    media: 'category-gaming.jpg',
  },
  {
    title: 'Accessories & Parts',
    slug: 'accessories-parts',
    description: 'Chargers, SSDs, batteries and the other parts a working laptop or phone depends on.',
    media: 'category-accessories.jpg',
  },
  {
    title: 'Printers & Office Tech',
    slug: 'printers-office-tech',
    description: 'Home and office printers at a range of budgets.',
    media: 'category-office-tech.jpg',
  },
]

export const SEED_PRODUCTS: SeedProduct[] = [
  // --- Smartphones --------------------------------------------------------
  {
    slug: 'iphone-15-pro-256gb-natural-titanium',
    title: 'iPhone 15 Pro, 256GB, Natural Titanium',
    description: 'Boxed, sealed stock. Titanium frame, USB-C, the A17 Pro chip.',
    body: [
      'New, boxed and sealed. This is current-generation Apple stock, not a refurbished or preloved unit — see the Preloved Smartphones listings if a lower price matters more than a new box.',
      'Natural titanium is the raw brushed finish rather than a polished colour; it marks less and does not show a case line as readily.',
      'Paid for through Paynow at checkout — EcoCash, OneMoney, Visa or Mastercard.',
    ],
    price: 120000,
    currency: SEED_CURRENCY,
    categorySlug: 'smartphones',
    media: 'products/apple-iphone-15-pro-256gb-natural-titanium.jpg',
    related: ['samsung-galaxy-s23-ultra-256gb-green', 'preloved-iphone-x-64gb'],
  },
  {
    slug: 'samsung-galaxy-s23-ultra-256gb-green',
    title: 'Samsung Galaxy S23 Ultra, 256GB',
    description: 'Boxed, sealed stock. The 200MP camera and S Pen in one body.',
    body: [
      'New, boxed and sealed Samsung stock. The S23 Ultra is the largest current Galaxy, built around its camera system and the built-in S Pen.',
      '256GB is enough storage for most people without paying for a tier they will not fill.',
      'Paid for through Paynow at checkout — EcoCash, OneMoney, Visa or Mastercard.',
    ],
    price: 63000,
    currency: SEED_CURRENCY,
    categorySlug: 'smartphones',
    media: 'products/samsung-galaxy-s23-ultra-256gb-green.jpg',
    related: ['iphone-15-pro-256gb-natural-titanium', 'huawei-p60-pro-256gb-black'],
  },
  {
    slug: 'huawei-p60-pro-256gb-black',
    title: 'Huawei P60 Pro, 256GB',
    description: 'Boxed stock. Huawei’s variable-aperture main camera in a flagship body.',
    body: [
      'New, boxed Huawei stock. The P60 Pro is built around its camera — a variable aperture on the main lens, unusual at this price, alongside a periscope telephoto.',
      'Runs HarmonyOS rather than Android with Google services; check that this suits the apps you rely on before ordering, and ask in-store if you are not sure.',
      'Paid for through Paynow at checkout — EcoCash, OneMoney, Visa or Mastercard.',
    ],
    price: 52000,
    currency: SEED_CURRENCY,
    categorySlug: 'smartphones',
    media: 'products/huawei-p60-pro-256gb-black.jpg',
    related: ['samsung-galaxy-s23-ultra-256gb-green', 'iphone-15-pro-256gb-natural-titanium'],
  },
  {
    slug: 'preloved-iphone-x-64gb',
    title: 'Preloved iPhone X, 64GB',
    description: 'Used, tested and working. The lowest-cost way into an iPhone here.',
    body: [
      'A preloved device — used, not new — checked and working, at a price well below sealed boxed stock. Cosmetic condition varies by unit; come in and see the actual phone before you buy, or ask us to describe it over WhatsApp.',
      'The X was Apple’s first Face ID iPhone. It runs current iOS updates but is several generations behind the 15 Pro on camera and battery life — the honest trade-off for the price.',
      'Preloved devices are sold as-is; ask in-store about what cover applies before you buy.',
    ],
    price: 19000,
    currency: SEED_CURRENCY,
    categorySlug: 'smartphones',
    media: 'products/preloved-iphone-x-64gb.jpg',
    related: ['huawei-p60-pro-256gb-black', 'iphone-15-pro-256gb-natural-titanium'],
  },

  // --- Gaming ---------------------------------------------------------------
  {
    slug: 'custom-gaming-pc-ryzen-5-rtx',
    title: 'Custom Gaming PC — Ryzen 5 / RTX Build',
    description: 'Built to order, not sold off a shelf. Tell us your budget and your games.',
    body: [
      'This is a starting configuration, not a fixed product: a Ryzen 5 processor, an RTX-class graphics card and a tempered-glass case with RGB lighting, built and tested in-store before collection.',
      'Component choice and final price depend on what is in stock and what you play — come in, call, or message us on WhatsApp with your budget and we will spec a build against it.',
      'The price shown is a starting point for this configuration and will be confirmed against current component pricing before your order is placed.',
    ],
    price: 65000,
    currency: SEED_CURRENCY,
    categorySlug: 'gaming',
    media: 'category-gaming.jpg',
    related: ['laptop-ssd-128-512gb'],
  },

  // --- Accessories & parts ---------------------------------------------------
  {
    slug: 'laptop-ssd-128-512gb',
    title: 'Laptop & Desktop SSD, 128GB–512GB',
    description: 'Solid-state upgrades for a laptop or desktop that has started to feel slow.',
    body: [
      'A mechanical hard drive is the single most common reason an older laptop feels slow; replacing it with an SSD is often a bigger improvement than replacing the whole machine.',
      'Stocked in 128GB, 256GB and 512GB. The price shown is for 256GB — ask in-store for 128GB or 512GB pricing, or for help choosing the right capacity.',
      'Fitting is available in-store; ask when you order.',
    ],
    price: 2400,
    currency: SEED_CURRENCY,
    categorySlug: 'accessories-parts',
    media: 'products/laptop-ssd-128-512gb.jpg',
    related: ['universal-laptop-charger'],
  },
  {
    slug: 'universal-laptop-charger',
    title: 'Universal Laptop Charger',
    description: 'Replacement chargers for the common laptop brands — bring your laptop in to match one.',
    body: [
      'Lost or worn-out laptop chargers, matched to your machine’s connector and voltage rather than sold as one generic part — bring the laptop in, or tell us the brand and model over WhatsApp.',
      'Covers the common brands stocked in-store: Dell, HP, Lenovo, Acer, Asus, Toshiba and others.',
      'The price shown is a typical starting price; the exact charger needed may cost more or less depending on wattage and connector type.',
    ],
    price: 1800,
    currency: SEED_CURRENCY,
    categorySlug: 'accessories-parts',
    media: 'products/universal-laptop-charger.jpg',
    related: ['laptop-ssd-128-512gb'],
  },

  // --- Printers & office tech -----------------------------------------------
  {
    slug: 'home-office-inkjet-printer',
    title: 'Home & Office Inkjet Printer',
    description: 'Quality printers for home or office use, at a range of budgets.',
    body: [
      'A compact colour inkjet printer, suited to home use or a small office that prints more photos and documents than it does high-volume paperwork.',
      'Laser and multifunction (print/scan/copy) models are also stocked at different price points — ask in-store for the full range and current pricing.',
      'Ink and toner for the models we sell are stocked separately.',
    ],
    price: 14000,
    currency: SEED_CURRENCY,
    categorySlug: 'printers-office-tech',
    media: 'products/home-office-inkjet-printer.jpg',
    related: [],
  },
]
