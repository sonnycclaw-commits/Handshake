#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const reasonPath = path.resolve('src/domain/constants/reason-codes.ts')
const mapPath = path.resolve('src/domain/constants/reason-code-http.ts')

const reasonSrc = fs.readFileSync(reasonPath, 'utf8')
const mapSrc = fs.readFileSync(mapPath, 'utf8')

const start = reasonSrc.indexOf('export const KNOWN_REASON_CODES = [')
const end = reasonSrc.indexOf('] as const', start)
if (start === -1 || end === -1) {
  console.error('Could not parse KNOWN_REASON_CODES block')
  process.exit(1)
}
const block = reasonSrc.slice(start, end)
const known = new Set([...block.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]))

const mapEntries = [...mapSrc.matchAll(/\s([a-z0-9_]+):\s(400|401|403|404|409|422|503),/g)].map((m) => m[1])
const mapped = new Set(mapEntries)

const missing = [...known].filter((c) => !mapped.has(c))
if (missing.length > 0) {
  console.error(`UNMAPPED_REASON_CODES:${missing.join(',')}`)
  process.exit(1)
}

console.log('Reason-code status map completeness check passed')
