// src/app/(admin)/admin/categories/page.tsx
//
// Categories list, with an inline create form.

import Link from 'next/link'

import { listCategoryOptions, listMediaOptions, withNoneOption } from '../../../_api/adminOptions'
import { listAdminCategoriesNative } from '../../../_api/adminQueries'
import { AdminForm } from '../_components/AdminForm'
import { AdminSection } from '../_components/AdminSection'
import { CategoriesTable, type CategoryRow } from './CategoriesTable'

import classes from '../_components/admin.module.scss'

export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage() {
  const [categories, categoryOptions, media] = await Promise.all([
    listAdminCategoriesNative(),
    listCategoryOptions(),
    listMediaOptions(),
  ])

  const rows: CategoryRow[] = categories.map(category => ({
    id: category.id,
    title: category.title,
    parentTitle: category.parentTitle,
    hasMedia: Boolean(category.mediaId),
    updatedAt: new Date(category.updatedAt).toISOString(),
  }))

  return (
    <>
      <div className={classes.pageHeader}>
        <div>
          <h1 className={classes.pageTitle}>Categories</h1>
          <p className={classes.pageSubtitle}>
            {rows.length} total. A category can only be deleted once nothing is filed under it.
          </p>
        </div>
      </div>

      <CategoriesTable rows={rows} />

      <div style={{ marginTop: '2rem' }}>
        <AdminSection title="New category">
          <AdminForm
            action="/api/admin/categories"
            method="POST"
            submitLabel="Create category"
            successMessage="Category created."
            fields={[
              { kind: 'text', name: 'title', label: 'Title', required: true },
              {
                kind: 'select',
                name: 'parentId',
                label: 'Parent category',
                options: withNoneOption(categoryOptions),
                defaultValue: '',
              },
              {
                kind: 'select',
                name: 'mediaId',
                label: 'Image',
                options: withNoneOption(media),
                defaultValue: '',
              },
            ]}
          />
        </AdminSection>
      </div>

      <p className={classes.pageSubtitle}>
        Need to add an image first? <Link href="/admin/media">Upload one</Link>.
      </p>
    </>
  )
}
