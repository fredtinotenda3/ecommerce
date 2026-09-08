// src/app/(pages)/products/[slug]/page.tsx

import React from 'react'
import { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'

import { fetchProduct, fetchProductSlugs } from '../../../_api/fetchProduct'
import { Blocks } from '../../../_components/Blocks'
import { PaywallBlocks } from '../../../_components/PaywallBlocks'
import { ProductHero } from '../../../_heros/Product'
import type { StorefrontProductDetail } from '../../../_types/storefront'
import { generateMeta } from '../../../_utilities/generateMeta'

// Dynamic so a price or stock change is never served from a stale render.
export const dynamic = 'force-dynamic'

export default async function ProductPage({ params: { slug } }) {
  const { isEnabled: isDraftMode } = draftMode()

  let product: StorefrontProductDetail | null = null

  try {
    product = await fetchProduct(slug, isDraftMode ? undefined : 'published')
  } catch (error) {
    console.error('product read failed:', error) // eslint-disable-line no-console
  }

  if (!product) {
    notFound()
  }

  const { relatedProducts, layout } = product

  return (
    <>
      <ProductHero product={product} />

      {/* The product's own body copy. Rendered before the paywall and the
          related row so the page reads top to bottom as description, then
          gated content, then alternatives. */}
      {Array.isArray(layout) && layout.length > 0 && <Blocks disableTopPadding blocks={layout} />}

      {product?.enablePaywall && <PaywallBlocks productSlug={slug as string} disableTopPadding />}

      {/* Only rendered when there is something to show: a "Related
          products" heading above an empty row looks like a failed load. */}
      {Array.isArray(relatedProducts) && relatedProducts.length > 0 && (
        <Blocks
          disableTopPadding
          blocks={[
            {
              blockType: 'relatedProducts',
              blockName: 'Related Products',
              relationTo: 'products',
              introContent: [
                {
                  type: 'h2',
                  children: [{ text: 'You might also like' }],
                },
              ],
              docs: relatedProducts,
            },
          ]}
        />
      )}
    </>
  )
}

export async function generateStaticParams() {
  try {
    // One object per dynamic segment, not a bare slug list.
    const slugs = await fetchProductSlugs()
    return slugs.filter(Boolean).map(slug => ({ slug }))
  } catch (error) {
    // No database at build time is normal; the route is `force-dynamic`.
    return []
  }
}

export async function generateMetadata({ params: { slug } }): Promise<Metadata> {
  const { isEnabled: isDraftMode } = draftMode()

  let product: StorefrontProductDetail | null = null

  try {
    product = await fetchProduct(slug, isDraftMode ? undefined : 'published')
  } catch (error) {
    // Metadata falls back to defaults.
  }

  return generateMeta({ doc: product })
}
