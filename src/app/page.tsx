// src/app/page.tsx
//
// `/` renders the same component as `/[slug]`, with the slug defaulting to
// `home`.
//
// The `dynamic` re-export below is not boilerplate. Route segment
// configuration in the App Router is per-FILE, not per-component:
// re-exporting only the component left this route on the default rendering
// mode while `(pages)/[slug]/page.tsx` declared `force-dynamic`. The
// homepage was therefore statically prerendered at build time, which meant
//
//   - catalogue changes never appeared on it until the next deploy, and
//   - a build run without a reachable database (CI, or a container that
//     receives its connection string at runtime) baked a permanent error
//     page into the bundle — which is exactly what was happening here.
//
// `generateStaticParams` is deliberately not re-exported: this route has no
// dynamic segment to enumerate.

import PageTemplate, { generateMetadata } from './(pages)/[slug]/page'

export const dynamic = 'force-dynamic'

export default PageTemplate

export { generateMetadata }
