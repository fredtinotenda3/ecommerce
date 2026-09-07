// src/app/(admin)/admin/categories/[id]/page.tsx
//
// Edit or delete one category.
//
// Deleting is refused while products or child categories still point at
// it, so the storefront can never render a filter that leads nowhere.

import { notFound } from 'next/navigation'
import Link from 'next/link'

import { listCategoryOptions, listMediaOptions, withNoneOption } from '../../../../_api/adminOptions'
import { listAdminCategoriesNative } from '../../../../_api/adminQueries'
import { AdminForm } from '../../_components/AdminForm'
import { AdminSection } from '../../_components/AdminSection'
import { DeleteButton } from '../../_components/DeleteButton'

export const dynamic = 'force-dynamic'

export default async function AdminCategoryDetailPage({
  params: { id },
}: {
  params: { id: string }
}) {
  const categories = await listAdminCategoriesNative()
  const category = categories.find(entry => entry.id === id)
  if (!category) notFound()

  const [categoryOptions, media] = await Promise.all([listCategoryOptions(), listMediaOptions()])

  return (
    <>
      <p>
        <Link href="/admin/categories">← Categories</Link>
      </p>
      <h1>{category.title}</h1>

      <AdminSection title="Details">
        <AdminForm
          action={`/api/admin/categories/${category.id}`}
          method="PATCH"
          submitLabel="Save category"
          fields={[
            {
              kind: 'text',
              name: 'title',
              label: 'Title',
              defaultValue: category.title,
              required: true,
            },
            {
              kind: 'select',
              name: 'parentId',
              label: 'Parent category',
              // A category cannot be its own parent; the server rejects
              // deeper loops too.
              options: withNoneOption(categoryOptions.filter(option => option.value !== category.id)),
              defaultValue: category.parentId ?? '',
            },
            {
              kind: 'select',
              name: 'mediaId',
              label: 'Image',
              options: withNoneOption(media),
              defaultValue: category.mediaId ?? '',
            },
          ]}
        />
      </AdminSection>

      <AdminSection title="Danger zone">
        <DeleteButton
          action={`/api/admin/categories/${category.id}`}
          confirmMessage={`Delete "${category.title}"?`}
          redirectTo="/admin/categories"
          label="Delete category"
        />
      </AdminSection>
    </>
  )
}
