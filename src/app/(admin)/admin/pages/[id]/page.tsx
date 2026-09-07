// src/app/(admin)/admin/pages/[id]/page.tsx
//
// Edit or delete a CMS page: hero, layout blocks and SEO.
//
// Hero and layout are edited as JSON. A block-by-block builder is a large
// piece of UI, and this keeps every block type the renderer supports
// editable today rather than only the ones a builder happens to cover. The
// server validates the shape on save, and the field reports a parse error
// before anything is submitted.

import { notFound } from 'next/navigation'
import Link from 'next/link'

import { listMediaOptions, withNoneOption } from '../../../../_api/adminOptions'
import { getAdminPageDetailNative } from '../../../../_api/adminQueries'
import { AdminForm } from '../../_components/AdminForm'
import { AdminSection } from '../../_components/AdminSection'
import { DeleteButton } from '../../_components/DeleteButton'
import { PreviewLink } from '../../_components/PreviewLink'

export const dynamic = 'force-dynamic'

const HERO_HELP =
  'JSON object. "type" is one of "none", "lowImpact", "mediumImpact", "highImpact", "customHero"; the rest ("richText", "links", "media") depends on the type.'

const LAYOUT_HELP =
  'JSON array of blocks. Supported blockType values: "cta", "content", "mediaBlock", "archive".'

export default async function AdminPageDetailPage({
  params: { id },
}: {
  params: { id: string }
}) {
  const page = await getAdminPageDetailNative(id)
  if (!page) notFound()

  const media = await listMediaOptions()

  return (
    <>
      <p>
        <Link href="/admin/pages">← Pages</Link>
      </p>
      <h1>{page.title}</h1>
      <p style={{ color: '#666' }}>
        {page.status === 'published' ? (
          <>
            Published —{' '}
            <a href={`/${page.slug}`} target="_blank" rel="noreferrer">
              view on the storefront
            </a>
          </>
        ) : (
          <>
            Draft — visible only through preview. <PreviewLink path={`/${page.slug}`} />
          </>
        )}
      </p>

      <AdminSection title="Content">
        <AdminForm
          action={`/api/admin/pages/${page.id}`}
          method="PATCH"
          submitLabel="Save page"
          fields={[
            { kind: 'text', name: 'title', label: 'Title', defaultValue: page.title, required: true },
            { kind: 'slug', name: 'slug', label: 'Slug', defaultValue: page.slug, required: true },
            {
              kind: 'select',
              name: 'status',
              label: 'Status',
              defaultValue: page.status,
              options: [
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
              ],
            },
            {
              kind: 'text',
              name: 'meta.title',
              label: 'SEO title',
              defaultValue: page.meta.title ?? '',
            },
            {
              kind: 'textarea',
              name: 'meta.description',
              label: 'SEO description',
              defaultValue: page.meta.description ?? '',
            },
            {
              kind: 'select',
              name: 'meta.image',
              label: 'Social share image',
              options: withNoneOption(media),
              defaultValue: page.meta.imageId ?? '',
            },
            {
              kind: 'json',
              name: 'hero',
              label: 'Hero',
              defaultValue: page.hero ?? { type: 'none' },
              help: HERO_HELP,
              rows: 8,
            },
            {
              kind: 'json',
              name: 'layout',
              label: 'Layout blocks',
              defaultValue: page.layout,
              help: LAYOUT_HELP,
              rows: 12,
            },
          ]}
        />
      </AdminSection>

      <AdminSection title="Danger zone">
        <DeleteButton
          action={`/api/admin/pages/${page.id}`}
          confirmMessage={`Delete "${page.title}"? Anything linking to /${page.slug} will 404.`}
          redirectTo="/admin/pages"
          label="Delete page"
        />
      </AdminSection>
    </>
  )
}
