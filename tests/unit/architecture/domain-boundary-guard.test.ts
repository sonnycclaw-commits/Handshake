import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, files)
    else if (full.endsWith('.ts')) files.push(full)
  }
  return files
}

describe('Architecture guard: domain must not import adapters (P2-C3)', () => {
  it('has no src/domain/** -> src/adapters/** imports', () => {
    const root = join(process.cwd(), 'src', 'domain')
    const files = walk(root)
    const violations: string[] = []

    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      const lines = content.split('\n')
      lines.forEach((line, i) => {
        const isImport = /^\s*import\s+.*from\s+['"].*['"]/u.test(line)
        if (!isImport) return

        // catches relative paths stepping into adapters plus aliased adapters paths
        if (line.includes('/adapters/') || line.includes("'../../adapters/") || line.includes('"../../adapters/')) {
          violations.push(`${file}:${i + 1}: ${line.trim()}`)
        }
      })
    }

    expect(violations, violations.join('\n')).toHaveLength(0)
  })
})
