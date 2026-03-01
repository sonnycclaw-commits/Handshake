import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../core/types'
import { toStructuredError, statusForReasonCode } from '../core/workflow'

export type IdentityEnvelope = {
  principalId: string
  subjectType: 'human' | 'service' | 'agent'
  roles: string[]
  scopes: string[]
  issuer?: string
  sessionId?: string
  tenantId?: string
}

const MAX_IDENTITY_ENVELOPE_BYTES = 4096
const MAX_STRING_LEN = 256
const ALLOWED_KEYS = new Set([
  'principalId',
  'subjectType',
  'roles',
  'scopes',
  'issuer',
  'sessionId',
  'tenantId',
])

function normalizeStringArray(value: unknown, field: 'roles' | 'scopes'): string[] | null {
  if (!Array.isArray(value)) return null

  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return null
    const trimmed = item.trim()
    if (!trimmed) return null
    if (trimmed.length > MAX_STRING_LEN) return null
    out.push(trimmed)
  }

  return Array.from(new Set(out)).sort((a, b) => a.localeCompare(b))
}

function normalizeOptionalString(value: unknown): string | undefined | null {
  if (value === undefined) return undefined
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_STRING_LEN) return null
  return trimmed
}

export function parseIdentityEnvelope(raw?: string): { ok: true; envelope: IdentityEnvelope } | { ok: false; reasonCode: string; message: string } {
  if (!raw || !raw.trim()) {
    return { ok: false, reasonCode: 'security_missing_identity_envelope', message: 'Identity envelope required' }
  }

  if (raw.length > MAX_IDENTITY_ENVELOPE_BYTES) {
    return { ok: false, reasonCode: 'security_invalid_identity_envelope', message: 'Identity envelope exceeds size limit' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reasonCode: 'security_invalid_identity_envelope', message: 'Identity envelope is not valid JSON' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reasonCode: 'security_invalid_identity_envelope', message: 'Identity envelope must be an object' }
  }

  const obj = parsed as Record<string, unknown>

  for (const key of Object.keys(obj)) {
    if (!ALLOWED_KEYS.has(key)) {
      return { ok: false, reasonCode: 'security_invalid_identity_envelope', message: `Unexpected identity envelope field: ${key}` }
    }
  }

  const principalId = typeof obj.principalId === 'string' ? obj.principalId.trim() : ''
  const subjectType = obj.subjectType

  if (!principalId) {
    return { ok: false, reasonCode: 'security_invalid_identity_envelope', message: 'principalId is required' }
  }

  if (principalId.length > MAX_STRING_LEN) {
    return { ok: false, reasonCode: 'security_invalid_identity_envelope', message: 'principalId exceeds size limit' }
  }

  if (subjectType !== 'human' && subjectType !== 'service' && subjectType !== 'agent') {
    return { ok: false, reasonCode: 'security_invalid_identity_envelope', message: 'subjectType is invalid' }
  }

  const roles = normalizeStringArray(obj.roles, 'roles')
  if (roles === null) {
    return { ok: false, reasonCode: 'security_invalid_identity_envelope', message: 'roles must be a string array' }
  }

  const scopes = normalizeStringArray(obj.scopes, 'scopes')
  if (scopes === null) {
    return { ok: false, reasonCode: 'security_invalid_identity_envelope', message: 'scopes must be a string array' }
  }

  const issuer = normalizeOptionalString(obj.issuer)
  if (issuer === null) {
    return { ok: false, reasonCode: 'security_invalid_identity_envelope', message: 'issuer must be a non-empty string' }
  }

  const sessionId = normalizeOptionalString(obj.sessionId)
  if (sessionId === null) {
    return { ok: false, reasonCode: 'security_invalid_identity_envelope', message: 'sessionId must be a non-empty string' }
  }

  const tenantId = normalizeOptionalString(obj.tenantId)
  if (tenantId === null) {
    return { ok: false, reasonCode: 'security_invalid_identity_envelope', message: 'tenantId must be a non-empty string' }
  }

  const envelope: IdentityEnvelope = {
    principalId,
    subjectType,
    roles,
    scopes,
    ...(issuer ? { issuer } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(tenantId ? { tenantId } : {}),
  }

  return { ok: true, envelope }
}

export const requireIdentityEnvelope: MiddlewareHandler<AppEnv> = async (c, next) => {
  const parsed = parseIdentityEnvelope(c.req.header('x-identity-envelope'))
  if (!parsed.ok) {
    return c.json(toStructuredError(parsed.reasonCode, parsed.message), statusForReasonCode(parsed.reasonCode))
  }

  c.set('identityEnvelope', parsed.envelope)
  await next()
}
