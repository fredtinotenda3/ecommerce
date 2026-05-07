'use client'

import React, { useState, useEffect } from 'react'
import { useField } from 'payload/components/forms'

export const ProductSelect: React.FC<{ 
  name: string
  label?: string 
  path?: string
  required?: boolean
}> = (props) => {
  const { name, label, required } = props
  
  const { value = '', setValue } = useField<string>({ path: name })
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string>(value as string || '')

  useEffect(() => {
    if (value !== undefined && value !== selectedProductId) {
      setSelectedProductId(value as string)
    }
  }, [value])

  useEffect(() => {
    const fetchStripeProducts = async () => {
      setLoading(true)
      setError(null)
      
      try {
        console.log('Fetching Stripe products from /api/stripe-products...')
        const response = await fetch('/api/stripe-products', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        console.log('Response status:', response.status)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
        }

        const result = await response.json()
        console.log('Stripe products response:', result)
        
        if (result.success && Array.isArray(result.data)) {
          console.log(`Successfully fetched ${result.data.length} products from Stripe`)
          setProducts(result.data)
        } else {
          throw new Error('Invalid response format from server')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
        console.error('Error fetching Stripe products:', err)
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchStripeProducts()
  }, [])

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value
    console.log('Selected product ID:', newValue)
    setSelectedProductId(newValue)
    setValue(newValue)
  }

  const selectedProduct = products.find(p => p.id === selectedProductId)
  const isTestMode = process.env.PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY === 'true'
  const href = `https://dashboard.stripe.com/${isTestMode ? 'test/' : ''}products/${selectedProductId}`

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ marginBottom: '8px' }}>
        <label 
          htmlFor={name}
          style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '600',
            fontSize: '14px',
          }}
        >
          {typeof label === 'string' ? label : 'Stripe Product'}
          {required && <span style={{ color: '#c62828', marginLeft: '4px' }}>*</span>}
        </label>
        <p
          style={{
            marginBottom: '12px',
            color: '#666',
            fontSize: '13px',
          }}
        >
          Select the related Stripe product or{' '}
          <a
            href={`https://dashboard.stripe.com/${isTestMode ? 'test/' : ''}products/create`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0070f3', textDecoration: 'none' }}
          >
            create a new one
          </a>
          .
        </p>
      </div>

      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            fontSize: '13px',
            border: '1px solid #ffcdd2',
          }}
        >
          <strong>Error loading Stripe products:</strong>
          <br />
          {error}
        </div>
      )}

      {loading && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#e3f2fd',
            color: '#1565c0',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        >
          🔄 Loading products from Stripe...
        </div>
      )}

      {!loading && !error && (
        <select
          id={name}
          name={name}
          value={selectedProductId}
          onChange={handleProductChange}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: '#fff',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <option value="">-- Select a product --</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      )}

      {!loading && !error && products.length === 0 && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px',
            backgroundColor: '#fff3e0',
            color: '#e65100',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        >
          ⚠️ No products found in Stripe. Create some products in your Stripe dashboard first.
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#666',
          }}
        >
          📦 {products.length} product(s) available in Stripe
        </div>
      )}

      {selectedProductId && !error && selectedProduct && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#e8f5e9',
            borderRadius: '4px',
            border: '1px solid #c8e6c9',
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                color: '#2e7d32',
                fontWeight: '600',
                letterSpacing: '0.5px',
              }}
            >
              ✅ Linked Product
            </span>
          </div>
          <div
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontWeight: '500',
            }}
          >
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: '#0070f3', textDecoration: 'none' }}
            >
              {selectedProduct.name}
            </a>
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
            Stripe ID: {selectedProduct.id}
          </div>
        </div>
      )}
    </div>
  )
}