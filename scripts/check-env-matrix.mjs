#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const wranglerPath = path.resolve('wrangler.toml')
if (!fs.existsSync(wranglerPath)) {
  console.error('WRANGLER_CONFIG_MISSING')
  process.exit(1)
}

const wrangler = fs.readFileSync(wranglerPath, 'utf8')
const lines = wrangler.split(/\r?\n/)

function readTopLevelBoolean(key) {
  for (const line of lines) {
    const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(true|false)\\s*$`))
    if (m) return m[1] === 'true'
  }
  return null
}

function sectionExists(name) {
  return lines.some((l) => l.trim() === `[${name}]`)
}

function readSectionVar(sectionName, key) {
  let inSection = false
  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('[') && line.endsWith(']')) {
      inSection = line === `[${sectionName}]`
      continue
    }
    if (!inSection) continue
    const m = line.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"\\s*$`))
    if (m) return m[1]
  }
  return null
}

const workersDev = readTopLevelBoolean('workers_dev')
const previewUrls = readTopLevelBoolean('preview_urls')
const hasProdEnv = sectionExists('env.production')
const prodEnvVar = readSectionVar('env.production.vars', 'ENVIRONMENT')

if (workersDev !== false) {
  console.error('ENV_MATRIX_FAIL:workers_dev_must_be_false')
  process.exit(1)
}

if (previewUrls !== false) {
  console.error('ENV_MATRIX_FAIL:preview_urls_must_be_false')
  process.exit(1)
}

if (!hasProdEnv) {
  console.error('ENV_MATRIX_FAIL:missing_env_production_block')
  process.exit(1)
}

if (prodEnvVar !== 'production') {
  console.error('ENV_MATRIX_FAIL:env_production_vars_environment_must_equal_production')
  process.exit(1)
}

console.log('Environment matrix check passed (prod-safe config)')
