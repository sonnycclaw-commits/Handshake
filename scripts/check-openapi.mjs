import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import SwaggerParser from '@apidevtools/swagger-parser'

const specPath = resolve(process.cwd(), 'openapi/handshake.v1.yaml')

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

function pointerGet(root, pointer) {
  if (!pointer.startsWith('#/')) return undefined
  const parts = pointer.slice(2).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
  let cur = root
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) return undefined
    cur = cur[p]
  }
  return cur
}

function assert(condition, message) {
  if (!condition) fail(`OpenAPI validation failed: ${message}`)
}

let raw = ''
try {
  raw = readFileSync(specPath, 'utf8')
} catch {
  fail('Missing OpenAPI spec: openapi/handshake.v1.yaml')
}

let doc
try {
  doc = parse(raw)
} catch (err) {
  fail(`OpenAPI YAML parse error: ${String(err)}`)
}

try {
  await SwaggerParser.validate(specPath)
} catch (err) {
  fail(`OpenAPI schema validation failed: ${String(err)}`)
}

assert(doc && typeof doc === 'object', 'spec is not an object')
assert(doc.openapi === '3.1.0', 'openapi version must be 3.1.0')
assert(doc.paths && typeof doc.paths === 'object', 'paths section missing')
assert(doc.components && typeof doc.components === 'object', 'components section missing')

const requiredOps = [
  ['/workflow/requests', 'post'],
  ['/workflow/requests/{requestId}', 'get'],
  ['/workflow/decision-room/{requestId}', 'get'],
  ['/workflow/decision-room/action', 'post'],
  ['/workflow/evidence/{requestId}', 'get'],
  ['/policy/config', 'get'],
  ['/policy/simulate', 'post'],
  ['/policy/apply', 'post'],
  ['/metrics/summary', 'get'],
  ['/metrics/series', 'get'],
  ['/metrics/reasons', 'get'],
  ['/agents', 'get'],
  ['/agents/{agentId}', 'get'],
  ['/entities', 'get'],
  ['/entities/{entityId}', 'get'],
]

for (const [path, method] of requiredOps) {
  assert(doc.paths[path], `missing path ${path}`)
  assert(doc.paths[path][method], `missing ${method.toUpperCase()} ${path}`)
  const op = doc.paths[path][method]
  assert(op.responses && typeof op.responses === 'object', `${method.toUpperCase()} ${path} missing responses`)
}

const errorSchema = pointerGet(doc, '#/components/schemas/ErrorResponse')
assert(errorSchema && typeof errorSchema === 'object', 'components.schemas.ErrorResponse missing')
for (const field of ['status', 'error', 'reasonCode', 'responseClass']) {
  assert(Array.isArray(errorSchema.required) && errorSchema.required.includes(field), `ErrorResponse.required missing ${field}`)
}

const responseClass = pointerGet(doc, '#/components/schemas/ResponseClass')
assert(responseClass && typeof responseClass === 'object', 'components.schemas.ResponseClass missing')
assert(Array.isArray(responseClass.enum), 'ResponseClass.enum missing')
for (const v of ['ok', 'retryable', 'blocked', 'unknown']) {
  assert(responseClass.enum.includes(v), `ResponseClass.enum missing ${v}`)
}

function walkRefs(node, refs = []) {
  if (Array.isArray(node)) {
    for (const item of node) walkRefs(item, refs)
    return refs
  }
  if (!node || typeof node !== 'object') return refs

  for (const [k, v] of Object.entries(node)) {
    if (k === '$ref' && typeof v === 'string') refs.push(v)
    else walkRefs(v, refs)
  }
  return refs
}

const refs = walkRefs(doc)
for (const ref of refs) {
  assert(ref.startsWith('#/'), `external refs not allowed in AP6 gate: ${ref}`)
  const target = pointerGet(doc, ref)
  assert(target !== undefined, `unresolved ref: ${ref}`)
}

const coreResponseContracts = [
  ['/workflow/requests', 'post', '200'],
  ['/workflow/decision-room/action', 'post', '200'],
  ['/policy/simulate', 'post', '200'],
  ['/policy/apply', 'post', '200'],
]

for (const [path, method, code] of coreResponseContracts) {
  const schema = doc.paths?.[path]?.[method]?.responses?.[code]?.content?.['application/json']?.schema
  assert(schema, `${method.toUpperCase()} ${path} ${code} missing application/json schema`)
}

const actionSecurity = doc.paths?.['/workflow/decision-room/action']?.post?.security
assert(Array.isArray(actionSecurity) && actionSecurity.length > 0, 'POST /workflow/decision-room/action missing security requirements')
assert(actionSecurity.some((s) => Object.prototype.hasOwnProperty.call(s, 'IdentityEnvelopeHeader')), 'decision action security missing IdentityEnvelopeHeader')

const applySecurity = doc.paths?.['/policy/apply']?.post?.security
assert(Array.isArray(applySecurity) && applySecurity.length > 0, 'POST /policy/apply missing security requirements')
assert(applySecurity.some((s) => Object.prototype.hasOwnProperty.call(s, 'IdentityEnvelopeHeader')), 'policy apply security missing IdentityEnvelopeHeader')
assert(applySecurity.some((s) => Object.prototype.hasOwnProperty.call(s, 'InternalTrustContextHeader')), 'policy apply security missing InternalTrustContextHeader')

const noAdditionalPropsPaths = [
  '#/components/schemas/ErrorResponse',
  '#/components/schemas/WorkflowArtifact',
  '#/components/schemas/DecisionActionResult',
  '#/components/schemas/AuthorizeExecutionResult',
  '#/components/schemas/PolicyApplyResult',
]
for (const ptr of noAdditionalPropsPaths) {
  const schema = pointerGet(doc, ptr)
  assert(schema && schema.additionalProperties === false, `${ptr} must set additionalProperties: false`)
}

console.log('OpenAPI semantic+schema check passed')
