import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('AP6 W5 RED — CI and release gate enforcement', () => {
  it('requires package scripts to run real AP6 checks (not placeholders)', () => {
    const pkgPath = resolve(process.cwd(), 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> }

    const ap6Gate = pkg.scripts?.['test:ap6-gate'] ?? ''
    const openapi = pkg.scripts?.['check:openapi'] ?? ''
    const sdkDrift = pkg.scripts?.['check:sdk-drift'] ?? ''

    // RED: placeholders should be replaced by real commands.
    expect(ap6Gate.includes('echo')).toBe(false)
    expect(openapi.includes('echo')).toBe(false)
    expect(sdkDrift.includes('echo')).toBe(false)
  })

  it('requires CI workflow to enforce AP6 gates', () => {
    const wfPath = resolve(process.cwd(), '.github/workflows/ci.yml')
    const content = readFileSync(wfPath, 'utf8')

    // RED: should fail until AP6 gates wired into CI.
    expect(content.includes('npm run test:ap6-gate')).toBe(true)
    expect(content.includes('npm run check:openapi')).toBe(true)
    expect(content.includes('npm run check:sdk-drift')).toBe(true)
  })

  it('requires AP6 go/no-go checklist evidence doc', () => {
    const checklistPath = resolve(process.cwd(), 'docs/workflow/AP6-RELEASE-CHECKLIST.md')
    const exists = (() => {
      try {
        readFileSync(checklistPath, 'utf8')
        return true
      } catch {
        return false
      }
    })()

    // RED: should fail until checklist doc exists.
    expect(exists).toBe(true)
  })
})
