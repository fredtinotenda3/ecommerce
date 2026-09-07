'use client'

// src/app/(admin)/admin/_components/DeleteButton.tsx
//
// Destructive action with a confirmation step.
//
// The server may refuse a delete — a category still on products, media
// still referenced — and that refusal carries a message explaining what is
// in the way. Surfacing it here is the point: a delete button that fails
// silently teaches an operator that the button is broken.

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export const DeleteButton: React.FC<{
  action: string
  label?: string
  confirmMessage: string
  redirectTo: string
}> = ({ action, label = 'Delete', confirmMessage, redirectTo }) => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleClick = async () => {
    if (!window.confirm(confirmMessage)) return

    setError(null)
    setIsDeleting(true)

    try {
      const response = await fetch(action, { method: 'DELETE', credentials: 'include' })
      const body = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        setError(typeof body?.error === 'string' ? body.error : `Delete failed (${response.status}).`)
        return
      }

      router.push(redirectTo)
      router.refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      {error && (
        <p role="alert" style={{ color: '#b00020' }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={isDeleting}
        style={{
          padding: '0.5rem 1rem',
          border: '1px solid #b00020',
          borderRadius: 4,
          background: 'transparent',
          color: '#b00020',
          cursor: isDeleting ? 'default' : 'pointer',
        }}
      >
        {isDeleting ? 'Deleting…' : label}
      </button>
    </div>
  )
}
