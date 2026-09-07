'use client'

// src/app/(admin)/admin/_components/AdminForm.tsx
//
// The one form component every admin editing screen is built from.
//
// Screens declare fields as data and this handles the rest: building the
// JSON body, submitting, surfacing the server's error message, and
// refreshing the page's server components on success so the list a user
// returns to reflects what they just changed.
//
// It exists so validation feedback, error handling and the shape of a
// request body are implemented once. Ten hand-written forms would drift,
// and the ones that drift are the ones that quietly stop showing errors.
//
// Nested field names use dots (`meta.title`), so a screen can describe the
// exact body the API expects without assembling it by hand.

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export type AdminFieldOption = { value: string; label: string }

export type AdminField =
  | {
      kind: 'text' | 'textarea' | 'slug'
      name: string
      label: string
      defaultValue?: string | null
      required?: boolean
      help?: string
      placeholder?: string
    }
  | {
      kind: 'number'
      name: string
      label: string
      defaultValue?: number | null
      required?: boolean
      help?: string
      min?: number
    }
  | {
      kind: 'select'
      name: string
      label: string
      options: AdminFieldOption[]
      defaultValue?: string | null
      help?: string
    }
  | {
      kind: 'multiselect'
      name: string
      label: string
      options: AdminFieldOption[]
      defaultValue?: string[]
      help?: string
    }
  | {
      kind: 'checkbox'
      name: string
      label: string
      defaultValue?: boolean
      help?: string
    }
  | {
      kind: 'json'
      name: string
      label: string
      defaultValue?: unknown
      help?: string
      rows?: number
    }

export interface AdminFormProps {
  action: string
  method?: 'POST' | 'PATCH' | 'PUT'
  fields: AdminField[]
  submitLabel: string
  /** Where to go after a successful submit. Omit to stay put and refresh. */
  redirectTo?: string
  /** Reads the created/updated record out of the response to build a
   * redirect target — used by "create" forms that jump to the new item. */
  redirectFrom?: (body: Record<string, unknown>) => string | null
  successMessage?: string
}

type FieldValue = string | boolean | string[]

const initialValues = (fields: AdminField[]): Record<string, FieldValue> => {
  const values: Record<string, FieldValue> = {}

  for (const field of fields) {
    switch (field.kind) {
      case 'checkbox':
        values[field.name] = Boolean(field.defaultValue)
        break
      case 'multiselect':
        values[field.name] = field.defaultValue ?? []
        break
      case 'json':
        values[field.name] = JSON.stringify(field.defaultValue ?? [], null, 2)
        break
      case 'number':
        values[field.name] = field.defaultValue == null ? '' : String(field.defaultValue)
        break
      default:
        values[field.name] = field.defaultValue ?? ''
    }
  }

  return values
}

/** Writes `value` into `target` at a dotted path, creating objects on the
 * way. `meta.title` becomes `{ meta: { title: value } }`. */
const assign = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const segments = path.split('.')
  let cursor = target

  segments.slice(0, -1).forEach(segment => {
    if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
      cursor[segment] = {}
    }
    cursor = cursor[segment] as Record<string, unknown>
  })

  cursor[segments[segments.length - 1]] = value
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  marginBottom: '0.25rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid #ccc',
  borderRadius: 4,
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  background: '#fff',
  color: '#111',
}

const helpStyle: React.CSSProperties = { color: '#666', fontSize: '0.85rem', marginTop: '0.25rem' }

export const AdminForm: React.FC<AdminFormProps> = ({
  action,
  method = 'POST',
  fields,
  submitLabel,
  redirectTo,
  redirectFrom,
  successMessage = 'Saved.',
}) => {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, FieldValue>>(() => initialValues(fields))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setValue = (name: string, value: FieldValue) => {
    setValues(current => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const body: Record<string, unknown> = {}

    // Parse JSON fields before any request is made, so a typo in a block
    // list is reported against that field rather than as a server error.
    for (const field of fields) {
      const raw = values[field.name]

      if (field.kind === 'json') {
        const text = String(raw).trim()
        if (text === '') {
          assign(body, field.name, [])
          continue
        }
        try {
          assign(body, field.name, JSON.parse(text))
        } catch {
          setError(`${field.label} is not valid JSON.`)
          return
        }
        continue
      }

      if (field.kind === 'number') {
        const text = String(raw).trim()
        if (text === '') {
          assign(body, field.name, null)
          continue
        }
        const parsed = Number(text)
        if (!Number.isFinite(parsed)) {
          setError(`${field.label} must be a number.`)
          return
        }
        assign(body, field.name, parsed)
        continue
      }

      assign(body, field.name, raw)
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(action, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const responseBody = (await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null

      if (!response.ok) {
        setError(
          typeof responseBody?.error === 'string'
            ? responseBody.error
            : `Request failed (${response.status}).`,
        )
        return
      }

      const target = redirectTo ?? (redirectFrom && responseBody ? redirectFrom(responseBody) : null)

      if (target) {
        router.push(target)
        router.refresh()
        return
      }

      setSuccess(successMessage)
      // Re-render the server components behind this form so lists and
      // detail views show the change without a manual reload.
      router.refresh()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', maxWidth: 720 }}>
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

      {fields.map(field => {
        const id = `field-${field.name}`
        const value = values[field.name]

        return (
          <div key={field.name}>
            {field.kind !== 'checkbox' && (
              <label htmlFor={id} style={labelStyle}>
                {field.label}
                {'required' in field && field.required ? ' *' : ''}
              </label>
            )}

            {(field.kind === 'text' || field.kind === 'slug') && (
              <input
                id={id}
                type="text"
                style={inputStyle}
                value={String(value)}
                placeholder={field.placeholder}
                required={field.required}
                onChange={event => setValue(field.name, event.target.value)}
              />
            )}

            {field.kind === 'textarea' && (
              <textarea
                id={id}
                style={{ ...inputStyle, minHeight: 90 }}
                value={String(value)}
                required={field.required}
                onChange={event => setValue(field.name, event.target.value)}
              />
            )}

            {field.kind === 'number' && (
              <input
                id={id}
                type="number"
                style={inputStyle}
                value={String(value)}
                min={field.min}
                required={field.required}
                onChange={event => setValue(field.name, event.target.value)}
              />
            )}

            {field.kind === 'select' && (
              <select
                id={id}
                style={inputStyle}
                value={String(value)}
                onChange={event => setValue(field.name, event.target.value)}
              >
                {field.options.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}

            {field.kind === 'multiselect' && (
              <div
                id={id}
                style={{
                  display: 'grid',
                  gap: '0.25rem',
                  maxHeight: 200,
                  overflowY: 'auto',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  padding: '0.5rem',
                }}
              >
                {field.options.length === 0 && <span style={helpStyle}>Nothing to choose yet.</span>}
                {field.options.map(option => {
                  const selected = (value as string[]).includes(option.value)
                  return (
                    <label key={option.value} style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          setValue(
                            field.name,
                            selected
                              ? (value as string[]).filter(entry => entry !== option.value)
                              : [...(value as string[]), option.value],
                          )
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {field.kind === 'checkbox' && (
              <label htmlFor={id} style={{ display: 'flex', gap: '0.5rem', fontWeight: 600 }}>
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={event => setValue(field.name, event.target.checked)}
                />
                <span>{field.label}</span>
              </label>
            )}

            {field.kind === 'json' && (
              <textarea
                id={id}
                style={{ ...inputStyle, minHeight: (field.rows ?? 8) * 20, fontFamily: 'monospace' }}
                value={String(value)}
                spellCheck={false}
                onChange={event => setValue(field.name, event.target.value)}
              />
            )}

            {field.help && <p style={helpStyle}>{field.help}</p>}
          </div>
        )
      })}

      <div>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: '0.6rem 1.2rem',
            border: 'none',
            borderRadius: 4,
            background: isSubmitting ? '#888' : '#111',
            color: '#fff',
            cursor: isSubmitting ? 'default' : 'pointer',
            fontSize: '0.95rem',
          }}
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
