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

  const { relatedProducts } = product

  return (
    <>
      <ProductHero product={product} />
      {product?.enablePaywall && <PaywallBlocks productSlug={slug as string} disableTopPadding />}
      <Blocks
        disableTopPadding
        blocks={[
          {
            blockType: 'relatedProducts',
            blockName: 'Related Product',
            relationTo: 'products',
            introContent: [
              {
                type: 'h3',
                children: [{ text: 'Related Products' }],
              },
            ],
            docs: relatedProducts,
          },
        ]}
      />
    </>
  )
}

export async function generateStaticParams() {
  try {
    return await fetchProductSlugs()
  } catch (error) {
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
