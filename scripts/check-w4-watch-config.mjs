#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const p = path.resolve('docs/workflow/W4-24H-WATCH.json')
if (!fs.existsSync(p)) {
  console.error('W4_WATCH_CONFIG_MISSING')
  process.exit(1)
}

let cfg
try {
  cfg = JSON.parse(fs.readFileSync(p, 'utf8'))
} catch {
  console.error('W4_WATCH_CONFIG_INVALID_JSON')
  process.exit(1)
}

if (cfg.windowHours !== 24) {
  console.error('W4_WATCH_WINDOW_INVALID')
  process.exit(1)
}

const requiredSignals = new Set([
  'alert_replay_guard_unavailable',
  'alert_denial_spike',
  'alert_tenant_mismatch_spike',
])

const signals = Array.isArray(cfg.signals) ? cfg.signals : []
for (const id of requiredSignals) {
  if (!signals.find((s) => s && s.id === id)) {
    console.error(`W4_WATCH_SIGNAL_MISSING:${id}`)
    process.exit(1)
  }
}

for (const s of signals) {
  if (!s.action || typeof s.action !== 'string') {
    console.error(`W4_WATCH_SIGNAL_ACTION_INVALID:${s?.id ?? 'unknown'}`)
    process.exit(1)
  }
}

console.log('W4 watch config check passed')
