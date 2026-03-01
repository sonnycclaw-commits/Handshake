import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const checks = [
  ['npx', ['vitest', 'run', 'tests/red/ap6/identity-envelope.ap6.red.test.ts', 'tests/red/ap6/trust-boundary.ap6.red.test.ts', 'tests/red/ap6/openapi-parity.ap6.red.test.ts', 'tests/red/ap6/sdk-accessibility.ap6.red.test.ts', 'tests/red/ap6/ap6-gates.ap6.red.test.ts']],
  ['npm', ['run', 'test:prod-gate']],
  ['npm', ['run', 'check:openapi']],
  ['npm', ['run', 'sdk:generate']],
  ['npm', ['run', 'sdk:check-generated']],
  ['npm', ['run', 'check:sdk-drift']],
  ['npm', ['run', 'test:sdk-smoke']],
  ['npx', ['tsc', '--noEmit']],
]

const report = {
  generatedAt: new Date().toISOString(),
  checks: [],
  status: 'pass',
}

for (const [cmd, args] of checks) {
  const label = `${cmd} ${args.join(' ')}`
  const startedAt = Date.now()
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false })
  const status = res.status === 0 ? 'pass' : 'fail'
  report.checks.push({
    label,
    status,
    exitCode: res.status ?? 1,
    durationMs: Date.now() - startedAt,
  })

  if (res.status !== 0) {
    report.status = 'fail'
    persistReport(report)
    process.exit(res.status ?? 1)
  }
}

persistReport(report)
console.log('AP6 gate passed')

function persistReport(payload) {
  const outDir = resolve(process.cwd(), 'artifacts')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'ap6-gate-report.json'), JSON.stringify(payload, null, 2))
}
