#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function verifyReleaseChecklistPayload(payload, now = Date.now()) {
  const required = ['generatedAt', 'commit', 'branch', 'gates']
  for (const k of required) {
    if (!(k in payload)) throw new Error(`RELEASE_CHECKLIST_MISSING_FIELD:${k}`)
  }

  const generatedAtMs = Date.parse(String(payload.generatedAt || ''))
  if (!Number.isFinite(generatedAtMs)) throw new Error('RELEASE_CHECKLIST_INVALID_GENERATED_AT')

  const maxAgeMs = 24 * 60 * 60 * 1000
  if (now - generatedAtMs > maxAgeMs) throw new Error('RELEASE_CHECKLIST_STALE')

  const gates = payload.gates || {}
  const requiredGates = [
    'check:schema-preflight',
    'check:env-matrix',
    'test:prod-gate',
    'check:release-readiness',
  ]

  for (const g of requiredGates) {
    if (gates[g] !== 'pass') throw new Error(`RELEASE_CHECKLIST_GATE_NOT_PASSING:${g}`)
  }
}

export function verifyReleaseChecklistFile(artifactPath = path.resolve('artifacts/release-checklist.json')) {
  if (!fs.existsSync(artifactPath)) throw new Error('RELEASE_CHECKLIST_MISSING')
  let payload
  try {
    payload = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
  } catch {
    throw new Error('RELEASE_CHECKLIST_INVALID_JSON')
  }
  verifyReleaseChecklistPayload(payload)
}

function main() {
  try {
    verifyReleaseChecklistFile()
    console.log('Release checklist verification passed')
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'RELEASE_CHECKLIST_UNKNOWN_ERROR')
    process.exit(1)
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) main()
