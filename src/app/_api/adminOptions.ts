// src/app/_api/adminOptions.ts
//
// Option lists for the admin forms: the categories, pages, products and
// media an operator can pick from.
//
// Kept in one module so every screen labels a relation the same way, and
// so a form never has to load a whole entity list just to build a select.
//
// Read-only.

import { getRepositories } from './repositories'

export interface AdminOption {
  value: string
  label: string
}

export const listCategoryOptions = async (): Promise<AdminOption[]> => {
  const { categories } = await getRepositories()
  const all = await categories.list()
  return all
    .map(category => ({ value: category.id, label: category.title }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export const listPageOptions = async (): Promise<AdminOption[]> => {
  const { pages } = await getRepositories()
  const all = await pages.list()
  return all
    .map(page => ({ value: page.id, label: `${page.title} (/${page.slug})` }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export const listProductOptions = async (excludeId?: string): Promise<AdminOption[]> => {
  const { products } = await getRepositories()
  const all = await products.list({ limit: 500 })
  return all
    .filter(product => product.id !== excludeId)
    .map(product => ({ value: product.id, label: `${product.title} (/${product.slug})` }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Media options carry the filename so an operator can tell two images
 * with the same alt text apart. */
export const listMediaOptions = async (): Promise<AdminOption[]> => {
  const { media } = await getRepositories()
  const all = await media.list(500)
  return all.map(item => ({
    value: item.id,
    label: item.filename ? `${item.alt || 'Untitled'} — ${item.filename}` : item.alt || item.id,
  }))
}

/** A select needs an explicit "none" entry: an empty string is how the
 * forms express "clear this relation". */
export const withNoneOption = (options: AdminOption[], label = '— none —'): AdminOption[] => [
  { value: '', label },
  ...options,
]
