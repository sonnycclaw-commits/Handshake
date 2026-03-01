#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const checks = [
  ['check:schema-preflight', 'npm run check:schema-preflight'],
  ['test:prod-gate', 'npm run test:prod-gate'],
]

for (const [label, cmd] of checks) {
  const out = spawnSync(cmd, { shell: true, stdio: 'inherit' })
  if ((out.status ?? 1) !== 0) {
    console.error(`RELEASE_READINESS_FAILED:${label}`)
    process.exit(out.status ?? 1)
  }
}

console.log('Release readiness check passed')
