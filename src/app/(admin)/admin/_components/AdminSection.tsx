// src/app/(admin)/admin/_components/AdminSection.tsx
//
// Presentational wrapper for a titled block on an admin screen. Server
// component: no state, no interactivity.

import type { ReactNode } from 'react'

export const AdminSection: React.FC<{
  title: string
  description?: string
  children: ReactNode
}> = ({ title, description, children }) => (
  <section
    style={{
      border: '1px solid #ddd',
      borderRadius: 6,
      padding: '1rem 1.25rem',
      marginBottom: '1.5rem',
    }}
  >
    <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>{title}</h2>
    {description && <p style={{ color: '#666', marginTop: '-0.5rem' }}>{description}</p>}
    {children}
  </section>
)
