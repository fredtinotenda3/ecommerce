// tests/noLegacyDependencies.test.ts
//
// Regression guard for the migration off the CMS and the old payment
// provider. These are cheap, static checks: they read the source tree and
// package manifest rather than importing anything, so they cannot be
// defeated by a module that only fails at runtime.
//
// If one of these fails, something reintroduced a dependency the
// application is supposed to no longer have.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..')

const collectSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc)
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

/** Import/require statements only. Prose in a comment that happens to
 * mention a package name is not a dependency. */
const importedModules = (source: string): string[] => {
  const specifiers: string[] = []
  const patterns = [/from\s+['"]([^'"]+)['"]/g, /require\(\s*['"]([^'"]+)['"]\s*\)/g]

  for (const pattern of patterns) {
    let match = pattern.exec(source)
    while (match) {
      specifiers.push(match[1])
      match = pattern.exec(source)
    }
  }

  return specifiers
}

const FORBIDDEN_MODULE = /^(payload|payload-admin-bar|stripe|@payloadcms\/|@stripe\/|slate)/

describe('no legacy runtime dependencies', () => {
  const sourceFiles = collectSourceFiles(join(ROOT, 'src'))

  it('finds source files to check (guards against a broken glob silently passing)', () => {
    expect(sourceFiles.length).toBeGreaterThan(50)
  })

  it('imports no CMS or Stripe package anywhere under src/', () => {
    const offenders: string[] = []

    for (const file of sourceFiles) {
      const bad = importedModules(readFileSync(file, 'utf8')).filter(spec =>
        FORBIDDEN_MODULE.test(spec),
      )
      if (bad.length > 0) {
        offenders.push(`${file.replace(`${ROOT}/`, '')}: ${bad.join(', ')}`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('imports no generated CMS types anywhere under src/', () => {
    const offenders = sourceFiles.filter(file =>
      importedModules(readFileSync(file, 'utf8')).some(spec => spec.includes('payload-types')),
    )

    expect(offenders.map(f => f.replace(`${ROOT}/`, ''))).toEqual([])
  })

  it('declares no CMS or Stripe package in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    const declared = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]

    expect(declared.filter(name => FORBIDDEN_MODULE.test(name))).toEqual([])
  })

  it('declares no CMS or Stripe script in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    const scripts = Object.values(pkg.scripts ?? {}) as string[]

    expect(scripts.filter(script => /payload|stripe listen/i.test(script))).toEqual([])
  })
})
