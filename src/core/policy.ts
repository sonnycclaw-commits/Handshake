import { createPolicyDraft, simulatePolicy, publishPolicy } from '../domain/services/policy-management'

export type PolicyScope = 'global' | 'agent'
export type PolicyRuleValue = string | number | boolean

export type PolicyRule = {
  id: string
  key: string
  value: PolicyRuleValue
}

export function isPolicyScope(value: unknown): value is PolicyScope {
  return value === 'global' || value === 'agent'
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isPolicyRuleValue(value: unknown): value is PolicyRuleValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

export function isPolicyRule(value: unknown): value is PolicyRule {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.key === 'string'
    && isPolicyRuleValue(value.value)
}

export function normalizeScopeId(scope: PolicyScope, scopeId?: string): string {
  if (scope === 'global') return '__global__'
  return String(scopeId ?? '').trim()
}

export function denormalizeScopeId(scope: PolicyScope, scopeId: string): string | undefined {
  if (scope === 'global') return undefined
  return scopeId
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function toPolicyShapeFromRules(rules: PolicyRule[]): {
  maxTransaction?: number
  dailySpendLimit?: number
  allowedHours?: string
  allowedCategories?: string[]
} {
  const policy: {
    maxTransaction?: number
    dailySpendLimit?: number
    allowedHours?: string
    allowedCategories?: string[]
  } = {}

  for (const rule of rules) {
    const key = rule.key.trim().toLowerCase()
    const value = rule.value

    if ((key === 'max_transaction' || key === 'maxtransaction' || key === 'max_payment') && typeof value === 'number') {
      policy.maxTransaction = value
      continue
    }

    if ((key === 'daily_spend_limit' || key === 'dailyspendlimit') && typeof value === 'number') {
      policy.dailySpendLimit = value
      continue
    }

    if (key === 'allowed_hours' && typeof value === 'string') {
      policy.allowedHours = value
      continue
    }

    if (key === 'allowed_categories') {
      if (typeof value === 'string') {
        policy.allowedCategories = value.split(',').map((v) => v.trim()).filter(Boolean)
      }
      continue
    }
  }

  return policy
}

export function parsePolicyConfigBody(body: unknown): { ok: true; scope: PolicyScope; scopeIdNormalized: string; scopeIdDisplay?: string; rules: PolicyRule[] } | { ok: false; reasonCode: string; message: string } {
  if (!isRecord(body)) {
    return { ok: false, reasonCode: 'trust_context_invalid_request_shape', message: 'Request body must be an object' }
  }

  const scopeRaw = body.scope
  if (!isPolicyScope(scopeRaw)) {
    return { ok: false, reasonCode: 'trust_context_invalid_request_shape', message: 'scope must be global|agent' }
  }

  const scope = scopeRaw
  const scopeIdInput = typeof body.scopeId === 'string' ? body.scopeId.trim() : undefined
  const scopeIdNormalized = normalizeScopeId(scope, scopeIdInput)

  if (scope === 'agent' && !scopeIdNormalized) {
    return { ok: false, reasonCode: 'trust_context_missing_binding', message: 'scopeId is required for agent scope' }
  }

  const rulesRaw = body.rules
  if (!Array.isArray(rulesRaw)) {
    return { ok: false, reasonCode: 'trust_context_invalid_request_shape', message: 'rules must be an array' }
  }

  const rules: PolicyRule[] = []
  for (const r of rulesRaw) {
    if (!isPolicyRule(r)) {
      return { ok: false, reasonCode: 'trust_context_invalid_request_shape', message: 'each rule must include id,key,value' }
    }
    rules.push({ id: r.id, key: r.key, value: r.value })
  }

  return {
    ok: true,
    scope,
    scopeIdNormalized,
    scopeIdDisplay: denormalizeScopeId(scope, scopeIdNormalized),
    rules,
  }
}

export { createPolicyDraft, simulatePolicy, publishPolicy }
