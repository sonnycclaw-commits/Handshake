#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

function fail(code, detail) {
  console.error(`${code}${detail ? `:${detail}` : ''}`)
  process.exit(1)
}

const migrationsDir = path.resolve('migrations')
if (!fs.existsSync(migrationsDir)) {
  fail('MIGRATIONS_DIR_MISSING')
}

const requiredMigrations = [
  '0007_replay_guards.sql',
  '0008_request_workflow_tenant.sql',
]

for (const file of requiredMigrations) {
  const full = path.join(migrationsDir, file)
  if (!fs.existsSync(full)) {
    fail('MISSING_MIGRATION', file)
  }
}

const replaySql = fs.readFileSync(path.join(migrationsDir, '0007_replay_guards.sql'), 'utf8')
if (!replaySql.includes('CREATE TABLE IF NOT EXISTS replay_guards')) {
  fail('REPLAY_GUARD_SCHEMA_MISSING')
}

const tenantSql = fs.readFileSync(path.join(migrationsDir, '0008_request_workflow_tenant.sql'), 'utf8')
if (!tenantSql.includes('ALTER TABLE request_workflow_requests ADD COLUMN tenant_id')) {
  fail('TENANT_MIGRATION_SCHEMA_MISSING')
}

const d1Store = fs.readFileSync(path.resolve('src/adapters/persistence/d1-request-workflow-store.ts'), 'utf8')
if (!d1Store.includes('tenant_id') || !d1Store.includes('record.tenantId')) {
  fail('TENANT_SCHEMA_WIRING_INCOMPLETE')
}

const replayGuard = fs.readFileSync(path.resolve('src/adapters/persistence/d1-replay-guard.ts'), 'utf8')
if (!replayGuard.includes('INSERT INTO replay_guards')) {
  fail('REPLAY_GUARD_WIRING_INCOMPLETE')
}

console.log('Schema preflight check passed (required migrations + replay/tenant wiring present)')
