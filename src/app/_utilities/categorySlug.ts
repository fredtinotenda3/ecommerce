// src/app/_utilities/categorySlug.ts
//
// Categories are stored with a title and no slug — that is the shape the
// existing `categories` collection has, and adding a slug field would mean
// a schema change, a migration and a new required field in the admin form
// for what is purely a URL-readability concern.
//
// Instead, a category's URL token is DERIVED from its title. `?category=`
// accepts either form:
//
//   /products?category=laptops                 (human-readable, from nav)
//   /products?category=66f1a2…                 (24-hex id, from the filter checkboxes)
//
// The id form stays canonical: it is what `Filters` submits and what
// `/api/products` filters on, so renaming a category can never break the
// filter UI. Only the hand-written navigation links in `constants/brand.ts`
// use the derived token, and an unrecognised token resolves to no filter
// rather than an error.
//
// Kept framework-free so both the server component and the route handler
// can use it.

/** Lowercase, ASCII-fold, collapse anything non-alphanumeric to a single
 * hyphen. `'TV & Home'` → `'tv-home'`, `'iPads'` → `'ipads'`. */
export const toCategorySlug = (title: string): string =>
  title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const OBJECT_ID = /^[0-9a-f]{24}$/i

/** True when a `?category=` token is already a Mongo id rather than a slug. */
export const isCategoryId = (token: string): boolean => OBJECT_ID.test(token)

/**
 * Resolve the `?category=` tokens on a request into category ids.
 *
 * Tokens that are already ids are kept as-is (without checking they exist —
 * the repository query simply matches nothing, which is the correct empty
 * result). Tokens that are slugs are matched against the derived slug of
 * each known category; unmatched slugs are dropped.
 *
 * Returns an empty array when nothing resolves, which callers must treat as
 * "no category filter" only if the input was also empty — a non-empty input
 * that resolves to nothing legitimately means "no products".
 */
export const resolveCategoryTokens = (
  tokens: string[],
  categories: { id: string; title?: string | null }[],
): string[] => {
  const bySlug = new Map<string, string>()

  categories.forEach(category => {
    if (category.title) bySlug.set(toCategorySlug(category.title), category.id)
  })

  const resolved: string[] = []

  tokens.forEach(token => {
    const trimmed = token.trim()
    if (!trimmed) return

    if (isCategoryId(trimmed)) {
      resolved.push(trimmed)
      return
    }

    const id = bySlug.get(toCategorySlug(trimmed))
    if (id) resolved.push(id)
  })

  return Array.from(new Set(resolved))
}
