#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const migration = path.resolve('migrations/0008_request_workflow_tenant.sql')
if (!fs.existsSync(migration)) {
  console.error('MISSING_MIGRATION:0008_request_workflow_tenant.sql')
  process.exit(1)
}

const d1Store = fs.readFileSync(path.resolve('src/adapters/persistence/d1-request-workflow-store.ts'),'utf8')
if (!d1Store.includes('tenant_id') || !d1Store.includes('record.tenantId')) {
  console.error('TENANT_SCHEMA_WIRING_INCOMPLETE')
  process.exit(1)
}

console.log('Schema preflight check passed (tenant_id migration + wiring present)')
