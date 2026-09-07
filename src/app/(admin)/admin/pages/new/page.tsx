// src/app/(admin)/admin/pages/new/page.tsx
//
// Create a CMS page. Starts as a draft; the edit screen carries the hero,
// layout and SEO fields.

import Link from 'next/link'

import { AdminForm } from '../../_components/AdminForm'

export const dynamic = 'force-dynamic'

export default function AdminNewPagePage() {
  return (
    <>
      <p>
        <Link href="/admin/pages">← Pages</Link>
      </p>
      <h1>New page</h1>

      <AdminForm
        action="/api/admin/pages"
        method="POST"
        submitLabel="Create page"
        redirectFrom={body => {
          const page = body.page as { id?: string } | undefined
          return page?.id ? `/admin/pages/${page.id}` : '/admin/pages'
        }}
        fields={[
          { kind: 'text', name: 'title', label: 'Title', required: true },
          {
            kind: 'slug',
            name: 'slug',
            label: 'Slug',
            required: true,
            help: 'Becomes /<slug>. Use "home" for the front page.',
          },
          {
            kind: 'select',
            name: 'status',
            label: 'Status',
            defaultValue: 'draft',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
            ],
          },
        ]}
      />
    </>
  )
}
