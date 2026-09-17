// tests/fakes/FakeGlobalsRepository.ts
import type { Footer, Header, Home, NavItem, Settings } from '../../src/lib/domain/types'
import type {
  FooterWriteInput,
  GlobalsRepository,
  HomeWriteInput,
  SettingsWriteInput,
} from '../../src/lib/repositories/GlobalsRepository'

export class FakeGlobalsRepository implements GlobalsRepository {
  private header: Header | null = null
  private footer: Footer | null = null
  private settings: Settings | null = null
  private home: Home | null = null

  seedHeader(header: Header): void {
    this.header = header
  }

  seedFooter(footer: Footer): void {
    this.footer = footer
  }

  seedSettings(settings: Settings): void {
    this.settings = settings
  }

  seedHome(home: Home): void {
    this.home = home
  }

  async getHeader(): Promise<Header | null> {
    return this.header
  }

  async getFooter(): Promise<Footer | null> {
    return this.footer
  }

  async getSettings(): Promise<Settings | null> {
    return this.settings
  }

  async getHome(): Promise<Home | null> {
    return this.home
  }

  async saveHeader(input: { navItems: NavItem[] }): Promise<Header> {
    this.header = {
      id: this.header?.id ?? 'header',
      navItems: input.navItems,
      createdAt: this.header?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }
    return this.header
  }

  async saveFooter(input: FooterWriteInput): Promise<Footer> {
    this.footer = {
      id: this.footer?.id ?? 'footer',
      copyright: input.copyright,
      navItems: input.navItems,
      linkGroups: input.linkGroups,
      createdAt: this.footer?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }
    return this.footer
  }

  async saveSettings(input: SettingsWriteInput): Promise<Settings> {
    this.settings = {
      id: this.settings?.id ?? 'settings',
      productsPageId: input.productsPageId,
      siteName: input.siteName,
      siteTagline: input.siteTagline,
      siteDescription: input.siteDescription,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      contactPhoneSecondary: input.contactPhoneSecondary,
      contactWhatsapp: input.contactWhatsapp,
      addressLines: input.addressLines,
      secondAddressLines: input.secondAddressLines,
      hours: input.hours,
      socialLinks: input.socialLinks,
      inclusions: input.inclusions,
      testimonials: input.testimonials,
      brandBackgroundImageId: input.brandBackgroundImageId,
      createdAt: this.settings?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }
    return this.settings
  }

  async saveHome(input: HomeWriteInput): Promise<Home> {
    this.home = {
      id: this.home?.id ?? 'home',
      ...input,
      createdAt: this.home?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }
    return this.home
  }
}

export const buildTestHeader = (overrides: Partial<Header> = {}): Header => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  navItems: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const buildTestFooter = (overrides: Partial<Footer> = {}): Footer => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  copyright: '© Test',
  navItems: [],
  linkGroups: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const buildTestSettings = (overrides: Partial<Settings> = {}): Settings => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  productsPageId: null,
  siteName: null,
  siteTagline: null,
  siteDescription: null,
  contactEmail: null,
  contactPhone: null,
  contactPhoneSecondary: null,
  contactWhatsapp: null,
  addressLines: [],
  secondAddressLines: [],
  hours: null,
  socialLinks: [],
  inclusions: [],
  testimonials: [],
  brandBackgroundImageId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const buildTestHome = (overrides: Partial<Home> = {}): Home => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  heroEyebrow: null,
  heroHeading: null,
  heroHeadingAccent: null,
  heroLede: null,
  heroProofPoints: [],
  heroPrimaryCtaLabel: null,
  heroPrimaryCtaHref: null,
  heroSecondaryCtaLabel: null,
  heroSecondaryCtaHref: null,
  heroImageId: null,
  videoEyebrow: null,
  videoHeading: null,
  videoLede: null,
  videoLinkLabel: null,
  videoLinkHref: null,
  videoId: null,
  videoPosterId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})
