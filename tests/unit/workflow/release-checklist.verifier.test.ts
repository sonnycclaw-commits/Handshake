import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const repo = '/home/ubuntu/.openclaw/workspace/projects/handshake'
const artifact = path.join(repo, 'artifacts', 'release-checklist.json')

describe('W4-D4 release checklist verifier', () => {
  it('passes on generated checklist', () => {
    execSync('npm run generate:release-checklist', { cwd: repo, stdio: 'pipe' })
    expect(() => execSync('npm run check:release-checklist', { cwd: repo, stdio: 'pipe' })).not.toThrow()
  })

  it('fails when required gate is not pass', () => {
    execSync('npm run generate:release-checklist', { cwd: repo, stdio: 'pipe' })
    const p = JSON.parse(fs.readFileSync(artifact, 'utf8'))
    p.gates['test:prod-gate'] = 'fail'
    fs.writeFileSync(artifact, JSON.stringify(p, null, 2))

    let failed = false
    try {
      execSync('npm run check:release-checklist', { cwd: repo, stdio: 'pipe' })
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
  })
})
