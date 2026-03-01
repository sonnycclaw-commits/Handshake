#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('src')
const files = []
function walk(dir){
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.isFile() && p.endsWith('.ts')) files.push(p)
  }
}
walk(root)

const offenders = []
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  if (src.includes("from '../domain/services/request-workflow'") || src.includes("from './request-workflow'") || src.includes("request-workflow.ts")) {
    offenders.push(f)
  }
}

if (offenders.length) {
  console.error('WORKFLOW_SHIM_IMPORTS_FOUND')
  for (const o of offenders) console.error(`- ${o}`)
  process.exit(1)
}
console.log('No workflow shim imports found in src')
