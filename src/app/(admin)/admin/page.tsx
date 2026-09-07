// src/app/(admin)/admin/page.tsx
//
// Index for /admin. Access is enforced by the route group's layout.

import Link from 'next/link'

export const dynamic = 'force-dynamic'

const SECTIONS: { href: string; title: string; description: string }[] = [
  {
    href: '/admin/products',
    title: 'Products',
    description: 'Create and edit products, set prices, publish or unpublish.',
  },
  {
    href: '/admin/categories',
    title: 'Categories',
    description: 'The category tree used by product filters.',
  },
  {
    href: '/admin/pages',
    title: 'Pages',
    description: 'CMS pages: hero, layout blocks and SEO.',
  },
  {
    href: '/admin/media',
    title: 'Media',
    description: 'Upload images and edit their alt text.',
  },
  {
    href: '/admin/orders',
    title: 'Orders',
    description: 'Order and payment status across all customers.',
  },
  {
    href: '/admin/customers',
    title: 'Customers',
    description: 'Accounts, their orders, and role assignment.',
  },
  {
    href: '/admin/globals',
    title: 'Globals',
    description: 'Header and footer navigation, and site settings.',
  },
  {
    href: '/admin/redirects',
    title: 'Redirects',
    description: 'Path redirects applied to incoming requests.',
  },
]

export default function AdminIndexPage() {
  return (
    <>
      <h1>Admin</h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1rem',
        }}
      >
        {SECTIONS.map(section => (
          <Link
            key={section.href}
            href={section.href}
            style={{
              border: '1px solid #ddd',
              borderRadius: 6,
              padding: '1rem',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <strong>{section.title}</strong>
            <p style={{ color: '#666', margin: '0.35rem 0 0' }}>{section.description}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
