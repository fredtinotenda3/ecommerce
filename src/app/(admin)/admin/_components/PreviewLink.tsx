// src/app/(admin)/admin/_components/PreviewLink.tsx
//
// Opens a draft page or product in the storefront through /api/preview.
//
// Server component, and only ever rendered inside the admin route group —
// which is why it may include the draft secret in the link when one is
// configured. The people who can see this page are the people the secret
// is for.

const buildPreviewHref = (path: string): string => {
  const params = new URLSearchParams({ url: path })

  const secret = process.env.NEXT_PRIVATE_DRAFT_SECRET
  if (secret) params.set('secret', secret)

  return `/api/preview?${params.toString()}`
}

export const PreviewLink: React.FC<{ path: string; label?: string }> = ({
  path,
  label = 'Preview draft',
}) => (
  <a href={buildPreviewHref(path)} target="_blank" rel="noreferrer">
    {label}
  </a>
)
