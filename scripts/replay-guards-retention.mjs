#!/usr/bin/env node
/**
 * Replay guard retention cleanup guidance.
 *
 * This script is intentionally non-destructive by default.
 * Use --apply to execute deletion in Wrangler-managed environments.
 */

const apply = process.argv.includes('--apply')

const sql = `DELETE FROM replay_guards WHERE expires_at < ${Date.now()};`

if (!apply) {
  console.log('Replay guard retention dry-run mode')
  console.log('Planned SQL:')
  console.log(sql)
  console.log('\nTo apply in environment, run:')
  console.log('  node scripts/replay-guards-retention.mjs --apply')
  console.log('Then execute via wrangler d1 (manual safety gate).')
  process.exit(0)
}

console.log('Apply mode requested.')
console.log('Execute the following with environment-appropriate DB binding:')
console.log(sql)
console.log('NOTE: Wire this into ops cron only after explicit approval.')
