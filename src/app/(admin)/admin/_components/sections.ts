// src/app/(admin)/admin/_components/sections.ts
//
// The admin's section list, in a module with NO 'use client' directive.
//
// This is deliberate and load-bearing. `AdminNav` is a client component
// (it needs `usePathname` to mark the current section), and the dashboard
// at /admin is a server component that renders the same list as cards.
// A server component cannot reach into a client module for a value —
// "You cannot dot into a client module from a server component" — so the
// data lives here, in a plain module both sides may import, and only the
// interactive rendering lives in the client component.
//
// The alternative, making the dashboard a client component, would ship the
// whole page to the browser to avoid moving one array. This is the right
// boundary.

export interface AdminSectionLink {
  href: string
  title: string
  description: string
}

export const ADMIN_SECTIONS: AdminSectionLink[] = [
  {
    href: '/admin/products',
    title: 'Products',
    description: 'Create and edit products, set prices, publish or unpublish in bulk.',
  },
  {
    href: '/admin/categories',
    title: 'Categories',
    description: 'The category tree behind the product filters and the homepage tiles.',
  },
  {
    href: '/admin/orders',
    title: 'Orders',
    description: 'Fulfilment status across every customer, with valid transitions enforced.',
  },
  {
    href: '/admin/customers',
    title: 'Customers',
    description: 'Accounts, their orders, and role assignment.',
  },
  {
    href: '/admin/pages',
    title: 'Pages',
    description: 'CMS pages: hero, layout blocks and SEO metadata.',
  },
  {
    href: '/admin/media',
    title: 'Media',
    description: 'Upload images, fix alt text, remove files that are no longer used.',
  },
  {
    href: '/admin/globals',
    title: 'Globals',
    description: 'Header and footer navigation, and site settings.',
  },
  {
    href: '/admin/redirects',
    title: 'Redirects',
    description: 'Path redirects applied to incoming requests by the edge middleware.',
  },
]
