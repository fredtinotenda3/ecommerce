// PHASE 13R: previously `Extract<Page['layout'][0], { blockType: 'archive'
// }>` (`Page` from `payload-types.ts`); now re-exported from the shared
// `StorefrontArchiveBlock` view model (`src/app/_types/storefront.ts`),
// same pattern as `CallToActionBlock`/`ContentBlock` (Phase 13L). This
// drops the `payload-types.ts` import from this file entirely.
// `src/app/_components/CollectionArchive/index.tsx`'s `Props` type derives
// `populatedDocs`/`populatedDocsTotal`/`categories` from `ArchiveBlockProps`
// by indexed access, so it follows this type change unchanged, with no
// edits needed there.
import type { StorefrontArchiveBlock } from '../../_types/storefront'

export type ArchiveBlockProps = StorefrontArchiveBlock
