// scripts/migrations/lib/migrationRunner.ts
//
// Minimal, reusable framework for the additive, non-destructive
// migrations this project needs (products now; users/orders/payments/
// categories/pages/media later — see the audit's Data Migration Plan).
//
// Design goals, directly from the Phase 1H requirements:
//   - dry-run by default unless --apply is passed
//   - safe to run repeatedly (idempotent) — each migration script decides
//     its own "already migrated" check; this runner just gives it a
//     consistent place to report that
//   - produces a detailed, structured report (console + JSON file)
//   - never issues DROP/TRUNCATE — this runner has no such capability at
//     all, by design, so a migration script literally cannot do it
//     through this framework

import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

export interface MigrationRecordResult {
  id: string
  action: 'migrated' | 'skipped' | 'error'
  reason?: string
  before?: unknown
  after?: unknown
}

export interface MigrationReport {
  migrationName: string
  dryRun: boolean
  startedAt: string
  finishedAt: string
  totalConsidered: number
  migrated: number
  skipped: number
  errors: number
  records: MigrationRecordResult[]
}

export interface MigrationContext {
  dryRun: boolean
  log: (message: string) => void
  recordResult: (result: MigrationRecordResult) => void
}

export type MigrationFn = (ctx: MigrationContext) => Promise<void>

export const parseDryRunFlag = (argv: string[] = process.argv): boolean => {
  // Dry-run is the SAFE DEFAULT. Only an explicit --apply flag turns off
  // dry-run mode. This deliberately inverts the more common "opt into
  // dry-run" pattern, because the cost of accidentally running for-real
  // against production is much higher than the cost of an extra flag.
  return !argv.includes('--apply')
}

export const runMigration = async (
  migrationName: string,
  fn: MigrationFn,
): Promise<MigrationReport> => {
  const dryRun = parseDryRunFlag()
  const startedAt = new Date().toISOString()
  const records: MigrationRecordResult[] = []

  const ctx: MigrationContext = {
    dryRun,
    log: message => {
      // eslint-disable-next-line no-console
      console.log(`[${migrationName}]${dryRun ? ' [DRY RUN]' : ''} ${message}`)
    },
    recordResult: result => {
      records.push(result)
    },
  }

  ctx.log(`Starting. Mode: ${dryRun ? 'DRY RUN (no writes)' : 'APPLY (will write)'}`)

  await fn(ctx)

  const finishedAt = new Date().toISOString()

  const report: MigrationReport = {
    migrationName,
    dryRun,
    startedAt,
    finishedAt,
    totalConsidered: records.length,
    migrated: records.filter(r => r.action === 'migrated').length,
    skipped: records.filter(r => r.action === 'skipped').length,
    errors: records.filter(r => r.action === 'error').length,
    records,
  }

  await writeReport(report)
  printSummary(report)

  return report
}

const writeReport = async (report: MigrationReport): Promise<void> => {
  const dir = join(process.cwd(), 'scripts', 'migrations', 'reports')
  await mkdir(dir, { recursive: true })
  const filename = `${report.migrationName}-${report.startedAt.replace(/[:.]/g, '-')}.json`
  await writeFile(join(dir, filename), JSON.stringify(report, null, 2), 'utf8')
  // eslint-disable-next-line no-console
  console.log(`[${report.migrationName}] Full report written to scripts/migrations/reports/${filename}`)
}

const printSummary = (report: MigrationReport): void => {
  // eslint-disable-next-line no-console
  console.log(
    `[${report.migrationName}] Done. considered=${report.totalConsidered} ` +
      `migrated=${report.migrated} skipped=${report.skipped} errors=${report.errors} ` +
      `(${report.dryRun ? 'DRY RUN — nothing was written' : 'APPLIED'})`,
  )
}
