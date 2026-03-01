import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'

const spec = parse(readFileSync(resolve(process.cwd(), 'openapi/handshake.v1.yaml'), 'utf8')) as any

type JsonSchema = any

function resolveRef(root: any, ref: string): JsonSchema {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported ref: ${ref}`)
  const parts = ref.slice(2).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
  let cur = root
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) throw new Error(`Unresolved ref ${ref}`)
    cur = cur[p]
  }
  return cur
}

function deref(root: any, schema: JsonSchema): JsonSchema {
  if (!schema) return schema
  if (schema.$ref) return deref(root, resolveRef(root, schema.$ref))
  if (schema.allOf) {
    return schema.allOf.map((s: JsonSchema) => deref(root, s)).reduce((acc: JsonSchema, cur: JsonSchema) => {
      return {
        ...acc,
        ...cur,
        required: [...new Set([...(acc.required ?? []), ...(cur.required ?? [])])],
        properties: { ...(acc.properties ?? {}), ...(cur.properties ?? {}) },
      }
    }, {})
  }
  return schema
}

function assertSchema(root: any, schema: JsonSchema, value: any, path = '$') {
  const s = deref(root, schema)
  if (!s) return

  if (s.oneOf) {
    const ok = s.oneOf.some((candidate: JsonSchema) => {
      try {
        assertSchema(root, candidate, value, path)
        return true
      } catch {
        return false
      }
    })
    if (!ok) throw new Error(`${path}: value does not match any oneOf schema`)
    return
  }

  if (s.enum) {
    if (!s.enum.includes(value)) throw new Error(`${path}: expected enum ${JSON.stringify(s.enum)} got ${JSON.stringify(value)}`)
  }

  if (s.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`${path}: expected object`)
    }

    for (const req of s.required ?? []) {
      if (!(req in value)) throw new Error(`${path}: missing required field ${req}`)
    }

    const props = s.properties ?? {}
    for (const [k, v] of Object.entries(props)) {
      if (k in value) assertSchema(root, v as JsonSchema, value[k], `${path}.${k}`)
    }
    return
  }

  if (s.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`${path}: expected array`)
    if (s.items) value.forEach((item, i) => assertSchema(root, s.items, item, `${path}[${i}]`))
    return
  }

  if (s.type === 'string') {
    if (typeof value !== 'string') throw new Error(`${path}: expected string`)
    return
  }

  if (s.type === 'number' || s.type === 'integer') {
    if (typeof value !== 'number') throw new Error(`${path}: expected number`)
    return
  }

  if (s.type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`${path}: expected boolean`)
  }
}

function responseSchema(path: string, method: 'get' | 'post', code: string): JsonSchema {
  const schema = spec.paths?.[path]?.[method]?.responses?.[code]?.content?.['application/json']?.schema
  if (!schema) throw new Error(`Missing schema for ${method.toUpperCase()} ${path} ${code}`)
  return schema
}

describe('AP6 runtime parity against OpenAPI', () => {
  it('workflow request response matches WorkflowRequestResult schema', () => {
    const sample = {
      requestId: 'wf-api-1',
      decision: 'escalate',
      reasonCode: 'hitl_required',
      tier: 2,
      timestamp: 1700000000000,
      decisionContextHash: 'ctx_hash',
      responseClass: 'retryable',
      hitlRequestId: 'hitl_1',
      state: 'escalated_pending',
    }

    assertSchema(spec, responseSchema('/workflow/requests', 'post', '200'), sample)
  })

  it('workflow decision action response matches DecisionActionResult schema', () => {
    const sample = {
      status: 'ok',
      requestId: 'wf-api-4',
      decision: 'allow',
      reasonCode: 'hitl_approved',
      artifact: {
        requestId: 'wf-api-4',
        decision: 'allow',
        reasonCode: 'hitl_approved',
        tier: 3,
        timestamp: 1700000001000,
        decisionContextHash: 'ctx_hash_2',
        responseClass: 'ok',
      },
    }

    assertSchema(spec, responseSchema('/workflow/decision-room/action', 'post', '200'), sample)
  })

  it('policy apply response matches PolicyApplyResult schema', () => {
    const sample = {
      status: 'ok',
      policyVersion: 'v1_hash',
      auditEventId: 'pa_v1_hash_1',
      message: 'Policy applied',
    }

    assertSchema(spec, responseSchema('/policy/apply', 'post', '200'), sample)
  })

  
  it('runtime toResponseClass output is contract-compatible', async () => {
    const { toResponseClass } = await import('@/domain/constants/reason-codes')
    const allowed = toResponseClass({ decision: 'allow', reasonCode: 'policy_allow' })
    const denied = toResponseClass({ decision: 'deny', reasonCode: 'security_invalid_identity_envelope' })
    const escalated = toResponseClass({ decision: 'escalate', reasonCode: 'hitl_boundary_escalated' })
    expect(allowed).toBe('ok')
    expect(denied).toBe('blocked')
    expect(escalated).toBe('retryable')
  })

  it('error envelope matches ErrorResponse schema', () => {
    const sample = {
      status: 'error',
      error: 'trust_context_invalid_request_shape',
      reasonCode: 'trust_context_invalid_request_shape',
      responseClass: 'blocked',
      message: 'Invalid JSON body',
    }

    assertSchema(spec, { $ref: '#/components/schemas/ErrorResponse' }, sample)
  })
})
