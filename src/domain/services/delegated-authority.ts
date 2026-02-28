import { invalidInput } from '../errors/governance-errors'

type DelegationInput = {
  from: string
  to: string
  scopes: string[]
  expiresAt?: number
}

type ValidateDelegatedActionInput = {
  scopes: string[]
  action: string
}

type DelegationRuntime = {
  now?: () => number
  nextId?: () => string
}

export type DelegationEnvelope = {
  id: string
  from: string
  to: string
  scopes: string[]
  issuedAt: number
  expiresAt?: number
}

export type DelegationValidation = {
  allowed: boolean
  reason?: string
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function normalizeScope(scope: string): string {
  return scope.trim().toLowerCase()
}

function actionAllowedByScope(scope: string, action: string): boolean {
  const a = action.trim().toLowerCase()
  if (scope === '*') return true
  if (scope === a) return true
  if (scope.endsWith(':*')) return a.startsWith(scope.slice(0, -1))
  return false
}

function defaultNextId(): string {
  return `del_${Math.random().toString(36).slice(2, 10)}`
}

export function issueDelegationEnvelope(input: DelegationInput, runtime: DelegationRuntime = {}): DelegationEnvelope {
  if (!input || typeof input !== 'object') throw invalidInput('object required')
  if (!isNonEmptyString(input.from) || !isNonEmptyString(input.to)) throw invalidInput('from/to required')
  if (!Array.isArray(input.scopes) || input.scopes.length === 0) throw invalidInput('scopes required')

  const now = runtime.now ?? Date.now
  const nextId = runtime.nextId ?? defaultNextId

  const scopes = Array.from(new Set(input.scopes.map((s) => (isNonEmptyString(s) ? normalizeScope(s) : '')).filter(Boolean)))
  if (scopes.length === 0) throw invalidInput('valid scopes required')

  const currentTime = now()

  if (input.expiresAt !== undefined) {
    if (!Number.isFinite(input.expiresAt) || input.expiresAt <= currentTime) {
      throw invalidInput('expiresAt must be future timestamp', { field: 'expiresAt' })
    }
  }

  return {
    id: nextId(),
    from: input.from.trim(),
    to: input.to.trim(),
    scopes,
    issuedAt: currentTime,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {})
  }
}

export function validateDelegatedAction(input: ValidateDelegatedActionInput): DelegationValidation {
  if (!input || typeof input !== 'object') return { allowed: false, reason: 'invalid_input' }
  if (!Array.isArray(input.scopes) || !isNonEmptyString(input.action)) return { allowed: false, reason: 'invalid_input' }

  const scopes = input.scopes.map((s) => (isNonEmptyString(s) ? normalizeScope(s) : '')).filter(Boolean)
  if (scopes.length === 0) return { allowed: false, reason: 'no_scopes' }

  const allowed = scopes.some((scope) => actionAllowedByScope(scope, input.action))
  return allowed ? { allowed: true } : { allowed: false, reason: 'outside_scope' }
}
