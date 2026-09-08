// tests/categorySlug.test.ts
//
// `?category=` accepts both ids and human-readable slugs. The interesting
// cases are the ones where the two forms could be confused, and the ones
// where an unknown token must NOT silently widen the result set.

import { describe, expect, it } from 'vitest'

import {
  isCategoryId,
  resolveCategoryTokens,
  toCategorySlug,
} from '../src/app/_utilities/categorySlug'

const CATEGORIES = [
  { id: '0123456789abcdef01234567', title: 'Laptops' },
  { id: '0123456789abcdef01234568', title: 'TV & Home' },
  { id: '0123456789abcdef01234569', title: 'iPads' },
]

describe('toCategorySlug', () => {
  it('lowercases and hyphenates', () => {
    expect(toCategorySlug('TV & Home')).toBe('tv-home')
    expect(toCategorySlug('iPads')).toBe('ipads')
    expect(toCategorySlug('Laptops')).toBe('laptops')
  })

  it('collapses runs of punctuation rather than emitting empty segments', () => {
    expect(toCategorySlug('Audio // Video')).toBe('audio-video')
  })

  it('trims leading and trailing separators', () => {
    expect(toCategorySlug('  & Accessories & ')).toBe('accessories')
  })

  it('folds accents rather than dropping the letter', () => {
    expect(toCategorySlug('Café')).toBe('cafe')
  })
})

describe('isCategoryId', () => {
  it('recognises a 24-hex id', () => {
    expect(isCategoryId('0123456789abcdef01234567')).toBe(true)
  })

  it('rejects a slug that happens to be hex-ish but the wrong length', () => {
    expect(isCategoryId('abcdef')).toBe(false)
    expect(isCategoryId('0123456789abcdef012345678')).toBe(false)
  })

  it('rejects a slug', () => {
    expect(isCategoryId('laptops')).toBe(false)
  })
})

describe('resolveCategoryTokens', () => {
  it('maps a slug onto the category id', () => {
    expect(resolveCategoryTokens(['laptops'], CATEGORIES)).toEqual(['0123456789abcdef01234567'])
  })

  it('passes an id straight through', () => {
    expect(resolveCategoryTokens(['0123456789abcdef01234569'], CATEGORIES)).toEqual([
      '0123456789abcdef01234569',
    ])
  })

  it('handles a mixture of the two forms', () => {
    expect(resolveCategoryTokens(['tv-home', '0123456789abcdef01234567'], CATEGORIES)).toEqual([
      '0123456789abcdef01234568',
      '0123456789abcdef01234567',
    ])
  })

  it('drops an unknown slug rather than guessing', () => {
    expect(resolveCategoryTokens(['nonsense'], CATEGORIES)).toEqual([])
  })

  it('de-duplicates when the same category arrives twice under both forms', () => {
    expect(resolveCategoryTokens(['laptops', '0123456789abcdef01234567'], CATEGORIES)).toEqual([
      '0123456789abcdef01234567',
    ])
  })

  it('ignores blank tokens', () => {
    expect(resolveCategoryTokens(['', '  ', 'laptops'], CATEGORIES)).toEqual([
      '0123456789abcdef01234567',
    ])
  })

  it('tolerates a category with no title', () => {
    expect(resolveCategoryTokens(['laptops'], [{ id: 'x', title: null }])).toEqual([])
  })
})
