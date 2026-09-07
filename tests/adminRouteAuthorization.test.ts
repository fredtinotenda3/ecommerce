// tests/adminRouteAuthorization.test.ts
//
// Every admin write endpoint must authorize before it does anything.
//
// This is a static check over the route files rather than a runtime one.
// That is deliberate: the failure mode being guarded against is a NEW
// route added later without an authorization call, and a runtime test only
// covers the routes someone remembered to write a test for. Reading the
// source catches the omission on the next test run, whoever adds it.
//
// A route that legitimately needs different handling would have to be
// added to `PUBLIC_ROUTES` below, which is a visible, reviewable act.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..')
const ADMIN_API_DIR = join(ROOT, 'src/app/api/admin')

/** Route files under /api/admin that are intentionally not admin-gated.
 * Empty, and expected to stay that way. */
const PUBLIC_ROUTES: string[] = []

const collectRouteFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectRouteFiles(full, acc)
    } else if (entry === 'route.ts') {
      acc.push(full)
    }
  }
  return acc
}

/** Exported HTTP method handlers in a route file. */
const exportedHandlers = (source: string): string[] =>
  Array.from(source.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g)).map(
    match => match[1],
  )

/** The body of one exported handler, up to the next export or end of file.
 * Good enough to assert the guard is inside the handler rather than merely
 * somewhere in the module. */
const handlerBody = (source: string, method: string): string => {
  const start = source.indexOf(`export async function ${method}`)
  if (start === -1) return ''

  const rest = source.slice(start + 1)
  const nextExport = rest.indexOf('\nexport ')

  return nextExport === -1 ? rest : rest.slice(0, nextExport)
}

describe('admin API authorization', () => {
  const routeFiles = collectRouteFiles(ADMIN_API_DIR)

  it('finds the admin routes (guards against a broken path silently passing)', () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(9)
  })

  it('every admin route file imports requireAdmin', () => {
    const offenders = routeFiles
      .filter(file => !PUBLIC_ROUTES.includes(relative(ROOT, file)))
      .filter(file => !readFileSync(file, 'utf8').includes('requireAdmin'))
      .map(file => relative(ROOT, file))

    expect(offenders).toEqual([])
  })

  it('every exported handler calls requireAdmin and returns on denial', () => {
    const offenders: string[] = []

    for (const file of routeFiles) {
      if (PUBLIC_ROUTES.includes(relative(ROOT, file))) continue

      const source = readFileSync(file, 'utf8')
      const handlers = exportedHandlers(source)

      if (handlers.length === 0) {
        offenders.push(`${relative(ROOT, file)}: no exported handlers found`)
        continue
      }

      for (const method of handlers) {
        const body = handlerBody(source, method)

        if (!body.includes('await requireAdmin()')) {
          offenders.push(`${relative(ROOT, file)}: ${method} does not call requireAdmin`)
          continue
        }

        if (!/if \(denied\b/.test(body)) {
          offenders.push(`${relative(ROOT, file)}: ${method} does not return on denial`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('authorizes before reading the request body, so an unauthorized upload is never buffered', () => {
    const offenders: string[] = []

    for (const file of routeFiles) {
      const source = readFileSync(file, 'utf8')

      for (const method of exportedHandlers(source)) {
        const body = handlerBody(source, method)

        const guardAt = body.indexOf('await requireAdmin()')
        const readAt = Math.min(
          ...['await readJsonBody(', 'await request.formData(', 'await request.json(']
            .map(needle => body.indexOf(needle))
            .filter(index => index !== -1)
            .concat([Number.MAX_SAFE_INTEGER]),
        )

        if (guardAt !== -1 && readAt !== Number.MAX_SAFE_INTEGER && readAt < guardAt) {
          offenders.push(`${relative(ROOT, file)}: ${method} reads the body before authorizing`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('the admin route group layout gates every admin page', () => {
    const layout = readFileSync(join(ROOT, 'src/app/(admin)/admin/layout.tsx'), 'utf8')

    expect(layout).toContain('getAdminAccess')
    expect(layout).toContain('notFound()')
  })

  it('requireAdmin denies with 404 rather than confirming the endpoint exists', () => {
    const source = readFileSync(join(ROOT, 'src/app/_api/requireAdmin.ts'), 'utf8')

    expect(source).toContain('status: 404')
    expect(source).not.toContain('status: 403')
  })

  it('admin mutations are only reachable through the service layer', () => {
    // Route handlers must not import repositories directly: that would let
    // a route write to the database without the validation and guards in
    // AdminContentService.
    const offenders = collectRouteFiles(ADMIN_API_DIR)
      .filter(file => /from '.*repositories\//.test(readFileSync(file, 'utf8')))
      .map(file => relative(ROOT, file))

    expect(offenders).toEqual([])
  })
})
