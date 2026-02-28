import { evaluatePolicy, type PolicyDecision } from './policy-evaluator'

type PolicyShape = {
  dailySpendLimit?: number
  maxTransaction?: number
  allowedHours?: string
  allowedCategories?: string[]
}

type PolicyDraftInput = {
  principalId: string
  policy: PolicyShape
}

type SimulatePolicyInput = {
  policy: PolicyShape
  request: {
    amount?: number
    category?: string
    hour?: number
  }
}

type PublishPolicyInput = {
  draftId: string
}

export type PolicyDraft = {
  id: string
  version: string
  principalId: string
  policy: PolicyShape
  status: 'draft'
}

export type PolicySimulation = PolicyDecision & {
  status: 'simulated'
}

export type PublishedPolicy = {
  draftId: string
  status: 'active'
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPolicyShape(value: unknown): value is PolicyShape {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const policy = value as PolicyShape

  if (policy.dailySpendLimit !== undefined && (!Number.isFinite(policy.dailySpendLimit) || policy.dailySpendLimit < 0)) return false
  if (policy.maxTransaction !== undefined && (!Number.isFinite(policy.maxTransaction) || policy.maxTransaction < 0)) return false
  if (policy.allowedHours !== undefined && typeof policy.allowedHours !== 'string') return false
  if (policy.allowedCategories !== undefined && (!Array.isArray(policy.allowedCategories) || policy.allowedCategories.some((c) => typeof c !== 'string'))) return false

  return true
}

export function createPolicyDraft(input: PolicyDraftInput): PolicyDraft {
  if (!input || typeof input !== 'object') {
    throw new Error('invalid_input: object required')
  }

  if (!isNonEmptyString(input.principalId)) {
    throw new Error('invalid_input: principalId is required')
  }

  if (!isPolicyShape(input.policy)) {
    throw new Error('invalid_input: policy is malformed')
  }

  const canonical = stableStringify({ principalId: input.principalId.trim(), policy: input.policy })
  const suffix = fnv1a(canonical)

  return {
    id: `draft_${suffix}`,
    version: `v_${suffix}`,
    principalId: input.principalId.trim(),
    policy: input.policy,
    status: 'draft'
  }
}

export function simulatePolicy(input: SimulatePolicyInput): PolicySimulation {
  if (!input || typeof input !== 'object' || !isPolicyShape(input.policy) || !input.request || typeof input.request !== 'object') {
    return {
      decision: 'deny',
      tier: 4,
      requiresHITL: true,
      reasons: ['invalid_input'],
      status: 'simulated'
    }
  }

  const hasCategoryAllowlist = Array.isArray(input.policy.allowedCategories) && input.policy.allowedCategories.length > 0
  if (hasCategoryAllowlist && !isNonEmptyString(input.request.category)) {
    return {
      decision: 'deny',
      tier: 4,
      requiresHITL: true,
      reasons: ['category_not_allowed'],
      status: 'simulated'
    }
  }

  if (input.policy.allowedHours !== undefined && !Number.isFinite(input.request.hour)) {
    return {
      decision: 'deny',
      tier: 4,
      requiresHITL: true,
      reasons: ['outside_allowed_hours'],
      status: 'simulated'
    }
  }

  const result = evaluatePolicy(input.policy, input.request)
  return {
    ...result,
    status: 'simulated'
  }
}

export function publishPolicy(input: PublishPolicyInput): PublishedPolicy {
  if (!input || typeof input !== 'object' || !isNonEmptyString(input.draftId)) {
    throw new Error('invalid_input: draftId is required')
  }

  const draftId = input.draftId.trim()
  if (!/^draft_[a-z0-9_\-]+$/i.test(draftId)) {
    throw new Error('invalid_input: draftId format invalid')
  }

  return {
    draftId,
    status: 'active'
  }
}
