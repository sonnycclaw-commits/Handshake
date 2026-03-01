#!/usr/bin/env node
import fs from 'node:fs'
import YAML from 'yaml'

const specPath = new URL('../openapi/handshake.v1.yaml', import.meta.url)
const raw = fs.readFileSync(specPath, 'utf8')
const spec = YAML.parse(raw)

const required = [
  { path: '/workflow/requests/{requestId}', method: 'get', scheme: 'IdentityEnvelopeHeader' },
  { path: '/workflow/decision-room/{requestId}', method: 'get', scheme: 'IdentityEnvelopeHeader' },
  { path: '/workflow/evidence/{requestId}', method: 'get', scheme: 'IdentityEnvelopeHeader' },
  { path: '/workflow/decision-room/action', method: 'post', scheme: 'IdentityEnvelopeHeader' },
  { path: '/policy/apply', method: 'post', scheme: 'IdentityEnvelopeHeader' },
  { path: '/policy/apply', method: 'post', scheme: 'InternalTrustContextHeader' },
]

function hasSecurityRequirement(op, scheme) {
  const security = Array.isArray(op?.security) ? op.security : []
  return security.some((entry) => entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, scheme))
}

const failures = []
for (const req of required) {
  const op = spec?.paths?.[req.path]?.[req.method]
  if (!op) {
    failures.push(`Missing operation: ${req.method.toUpperCase()} ${req.path}`)
    continue
  }
  if (!hasSecurityRequirement(op, req.scheme)) {
    failures.push(`Missing security scheme ${req.scheme} on ${req.method.toUpperCase()} ${req.path}`)
  }
}

if (failures.length > 0) {
  console.error('Protected route security parity check failed:')
  for (const f of failures) console.error(`- ${f}`)
  process.exit(1)
}

console.log('Protected route security parity check passed')
