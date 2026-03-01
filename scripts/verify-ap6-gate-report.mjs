import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const reportPath = resolve(process.cwd(), 'artifacts/ap6-gate-report.json')

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

if (!existsSync(reportPath)) {
  fail('AP6 report verification failed: artifacts/ap6-gate-report.json missing')
}

let report
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'))
} catch (err) {
  fail(`AP6 report verification failed: invalid JSON (${String(err)})`)
}

if (report.status !== 'pass') {
  fail(`AP6 report verification failed: report status is ${String(report.status)}`)
}

if (!Array.isArray(report.checks) || report.checks.length === 0) {
  fail('AP6 report verification failed: checks array missing or empty')
}

const requiredLabels = [
  'npx vitest run tests/red/ap6/identity-envelope.ap6.red.test.ts tests/red/ap6/trust-boundary.ap6.red.test.ts tests/red/ap6/openapi-parity.ap6.red.test.ts tests/red/ap6/sdk-accessibility.ap6.red.test.ts tests/red/ap6/ap6-gates.ap6.red.test.ts',
  'npm run test:prod-gate',
  'npm run check:openapi',
  'npm run sdk:generate',
  'npm run sdk:check-generated',
  'npm run check:sdk-drift',
  'npm run test:sdk-smoke',
  'npx tsc --noEmit',
]

const byLabel = new Map(report.checks.map((c) => [c.label, c]))

for (const label of requiredLabels) {
  const entry = byLabel.get(label)
  if (!entry) fail(`AP6 report verification failed: missing check label: ${label}`)
  if (entry.status !== 'pass') fail(`AP6 report verification failed: check did not pass: ${label}`)
  if (typeof entry.exitCode !== 'number' || entry.exitCode !== 0) {
    fail(`AP6 report verification failed: non-zero exitCode for ${label}`)
  }
}

console.log('AP6 report verification passed')
