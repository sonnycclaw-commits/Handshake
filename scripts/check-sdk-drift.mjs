import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

const specPath = resolve(process.cwd(), 'openapi/handshake.v1.yaml')
const clientPath = resolve(process.cwd(), 'sdk/typescript/src/handshake-client.ts')
const errorsPath = resolve(process.cwd(), 'sdk/typescript/src/errors.ts')
const generatedSdkPath = resolve(process.cwd(), 'sdk/typescript/generated/sdk.gen.ts')
const generatedTypesPath = resolve(process.cwd(), 'sdk/typescript/generated/types.gen.ts')
const pkgPath = resolve(process.cwd(), 'sdk/typescript/package.json')
const smokePath = resolve(process.cwd(), 'sdk/typescript/tests/quickstart.smoke.test.ts')

for (const p of [specPath, clientPath, errorsPath, generatedSdkPath, generatedTypesPath, pkgPath, smokePath]) {
  if (!existsSync(p)) fail(`SDK drift check failed: missing ${p}`)
}

const spec = parse(readFileSync(specPath, 'utf8'))
const client = readFileSync(clientPath, 'utf8')
const errors = readFileSync(errorsPath, 'utf8')
const generatedSdk = readFileSync(generatedSdkPath, 'utf8')
const generatedTypes = readFileSync(generatedTypesPath, 'utf8')

const requiredPathToMethod = [
  ['/workflow/requests', 'submitRequest'],
  ['/workflow/requests/{requestId}', 'getRequest'],
  ['/workflow/decision-room/{requestId}', 'getDecisionRoom'],
  ['/workflow/decision-room/action', 'resolveAction'],
  ['/workflow/evidence/{requestId}', 'evidence'],
  ['/policy/config', 'config'],
  ['/policy/simulate', 'simulate'],
  ['/policy/apply', 'apply'],
  ['/agents', 'agents'],
  ['/entities', 'entities'],
]

for (const [path, methodToken] of requiredPathToMethod) {
  if (!spec?.paths?.[path]) fail(`SDK drift: OpenAPI missing path ${path}`)
  if (!client.includes(methodToken)) fail(`SDK drift: wrapper missing method/token ${methodToken}`)
}

const generatedOps = [
  'submitWorkflowRequest',
  'resolveDecisionAction',
  'simulatePolicy',
  'applyPolicy',
  'listAgents',
  'listEntities',
]
for (const op of generatedOps) {
  if (!generatedSdk.includes(op)) fail(`SDK drift: generated sdk missing op ${op}`)
}

for (const token of ['reasonCode', 'responseClass', 'retryable', 'HandshakeApiError']) {
  if (!errors.includes(token)) fail(`SDK drift: errors contract missing ${token}`)
}

if (!generatedTypes.includes("export type ResponseClass = 'ok' | 'retryable' | 'blocked' | 'unknown'")) {
  fail('SDK drift: generated types missing canonical ResponseClass enum')
}

if (!client.includes('workflow = {') || !client.includes('policy = {') || !client.includes('agents = {') || !client.includes('entities = {')) {
  fail('SDK drift: wrapper group surface is incomplete')
}

if (!spec?.components?.securitySchemes?.IdentityEnvelopeHeader) fail('SDK drift: missing IdentityEnvelopeHeader security scheme')
if (!spec?.components?.securitySchemes?.InternalTrustContextHeader) fail('SDK drift: missing InternalTrustContextHeader security scheme')

console.log('SDK semantic drift check passed')
