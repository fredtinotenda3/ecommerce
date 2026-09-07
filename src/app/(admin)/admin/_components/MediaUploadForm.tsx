'use client'

// src/app/(admin)/admin/_components/MediaUploadForm.tsx
//
// Upload form for the media library.
//
// Sends multipart/form-data so the browser streams the file rather than
// this holding a base64 copy in memory. The server re-checks size, type
// and the file's own magic number — the `accept` attribute here is a
// convenience for the file picker, not a control.

import React, { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,image/avif'

export const MediaUploadForm: React.FC = () => {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [alt, setAlt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const file = inputRef.current?.files?.[0]
    if (!file) {
      setError('Choose a file first.')
      return
    }

    const body = new FormData()
    body.append('file', file)
    if (alt.trim()) body.append('alt', alt.trim())

    setIsUploading(true)

    try {
      const response = await fetch('/api/admin/media', {
        method: 'POST',
        credentials: 'include',
        body,
      })

      const responseBody = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        setError(
          typeof responseBody?.error === 'string'
            ? responseBody.error
            : `Upload failed (${response.status}).`,
        )
        return
      }

      setSuccess(`Uploaded ${file.name}.`)
      setAlt('')
      if (inputRef.current) inputRef.current.value = ''
      router.refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'grid',
        gap: '0.75rem',
        maxWidth: 520,
        border: '1px solid #ddd',
        borderRadius: 6,
        padding: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      <strong>Upload media</strong>

      {error && (
        <p role="alert" style={{ color: '#b00020', margin: 0 }}>
          {error}
        </p>
      )}
      {success && (
        <p role="status" style={{ color: '#0a7c2f', margin: 0 }}>
          {success}
        </p>
      )}

      <input ref={inputRef} type="file" accept={ACCEPT} required />

      <label>
        <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
          Alt text
        </span>
        <input
          type="text"
          value={alt}
          placeholder="Describe the image for screen readers"
          onChange={event => setAlt(event.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: 4,
          }}
        />
      </label>

      <div>
        <button
          type="submit"
          disabled={isUploading}
          style={{
            padding: '0.6rem 1.2rem',
            border: 'none',
            borderRadius: 4,
            background: isUploading ? '#888' : '#111',
            color: '#fff',
            cursor: isUploading ? 'default' : 'pointer',
          }}
        >
          {isUploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>
        JPEG, PNG, GIF, WebP or AVIF, up to 10MB. SVG is not accepted: it can carry script, and
        these files are served from this site&apos;s own origin.
      </p>
    </form>
  )
}
