#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const artifactPath = path.resolve('artifacts/release-checklist.json')
if (!fs.existsSync(artifactPath)) {
  console.error('RELEASE_CHECKLIST_MISSING')
  process.exit(1)
}

let payload
try {
  payload = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
} catch {
  console.error('RELEASE_CHECKLIST_INVALID_JSON')
  process.exit(1)
}

const required = ['generatedAt', 'commit', 'branch', 'gates']
for (const k of required) {
  if (!(k in payload)) {
    console.error(`RELEASE_CHECKLIST_MISSING_FIELD:${k}`)
    process.exit(1)
  }
}

const now = Date.now()
const generatedAtMs = Date.parse(String(payload.generatedAt || ''))
if (!Number.isFinite(generatedAtMs)) {
  console.error('RELEASE_CHECKLIST_INVALID_GENERATED_AT')
  process.exit(1)
}

const maxAgeMs = 24 * 60 * 60 * 1000
if (now - generatedAtMs > maxAgeMs) {
  console.error('RELEASE_CHECKLIST_STALE')
  process.exit(1)
}

const gates = payload.gates || {}
const requiredGates = [
  'check:schema-preflight',
  'check:env-matrix',
  'test:prod-gate',
  'check:release-readiness',
]

for (const g of requiredGates) {
  if (gates[g] !== 'pass') {
    console.error(`RELEASE_CHECKLIST_GATE_NOT_PASSING:${g}`)
    process.exit(1)
  }
}

console.log('Release checklist verification passed')
