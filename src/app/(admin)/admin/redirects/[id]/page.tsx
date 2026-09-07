// src/app/(admin)/admin/redirects/[id]/page.tsx
//
// Edit or delete one redirect.

import { notFound } from 'next/navigation'
import Link from 'next/link'

import { getRepositories } from '../../../../_api/repositories'
import { AdminForm } from '../../_components/AdminForm'
import { AdminSection } from '../../_components/AdminSection'
import { DeleteButton } from '../../_components/DeleteButton'

export const dynamic = 'force-dynamic'

export default async function AdminRedirectDetailPage({
  params: { id },
}: {
  params: { id: string }
}) {
  const { redirects } = await getRepositories()
  const redirect = await redirects.getById(id).catch(() => null)
  if (!redirect) notFound()

  return (
    <>
      <p>
        <Link href="/admin/redirects">← Redirects</Link>
      </p>
      <h1>{redirect.from}</h1>

      <AdminSection title="Details">
        <AdminForm
          action={`/api/admin/redirects/${redirect.id}`}
          method="PATCH"
          submitLabel="Save redirect"
          fields={[
            { kind: 'text', name: 'from', label: 'From', defaultValue: redirect.from, required: true },
            { kind: 'text', name: 'to', label: 'To', defaultValue: redirect.to, required: true },
            {
              kind: 'checkbox',
              name: 'permanent',
              label: 'Permanent (308)',
              defaultValue: redirect.permanent,
            },
            {
              kind: 'checkbox',
              name: 'enabled',
              label: 'Enabled',
              defaultValue: redirect.enabled,
              help: 'Disable to stage a rule without it taking effect.',
            },
          ]}
        />
      </AdminSection>

      <AdminSection title="Danger zone">
        <DeleteButton
          action={`/api/admin/redirects/${redirect.id}`}
          confirmMessage={`Delete the redirect from ${redirect.from}?`}
          redirectTo="/admin/redirects"
          label="Delete redirect"
        />
      </AdminSection>
    </>
  )
}
