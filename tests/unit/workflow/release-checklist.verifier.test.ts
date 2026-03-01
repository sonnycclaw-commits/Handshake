import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const repo = '/home/ubuntu/.openclaw/workspace/projects/handshake'
const artifact = path.join(repo, 'artifacts', 'release-checklist.json')

function runNodeScript(relPath: string) {
  const out = spawnSync(process.execPath, [path.join(repo, relPath)], {
    cwd: repo,
    stdio: 'pipe',
    env: process.env,
  })
  return out
}

describe('W4-D4 release checklist verifier', () => {
  it('passes on generated checklist', () => {
    const gen = runNodeScript('scripts/generate-release-checklist.mjs')
    expect(gen.status).toBe(0)

    const check = runNodeScript('scripts/check-release-checklist.mjs')
    expect(check.status).toBe(0)
  })

  it('fails when required gate is not pass', () => {
    const gen = runNodeScript('scripts/generate-release-checklist.mjs')
    expect(gen.status).toBe(0)

    const p = JSON.parse(fs.readFileSync(artifact, 'utf8'))
    p.gates['test:prod-gate'] = 'fail'
    fs.writeFileSync(artifact, JSON.stringify(p, null, 2))

    const check = runNodeScript('scripts/check-release-checklist.mjs')
    expect(check.status).not.toBe(0)
  })
})
