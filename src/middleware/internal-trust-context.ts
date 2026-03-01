import { createHmac, timingSafeEqual } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv, InternalTrustContext } from '../core/types'
import { toStructuredError, statusForReasonCode } from '../core/workflow'
import { createReplayGuard } from '../core/replay-guard'

const MAX_TOKEN_BYTES = 4096
const SKEW_MS = 30_000
const JTI_TTL_SECONDS = 300 // 5 minutes

function b64urlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(`${normalized}${pad}`, 'base64').toString('utf8')
}

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function parseInternalTrustToken(raw: string): { payload: InternalTrustContext; signingInput: string; signature: Buffer } | null {
  const parts = raw.split('.')
  if (parts.length !== 3) return null

  const [h, p, s] = parts
  if (!h || !p || !s) return null

  let header: any
  let payload: any
  try {
    header = JSON.parse(b64urlDecode(h))
    payload = JSON.parse(b64urlDecode(p))
  } catch {
    return null
  }

  if (header?.alg !== 'HS256' || header?.typ !== 'JWT') return null

  const signature = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  return {
    payload,
    signingInput: `${h}.${p}`,
    signature,
  }
}

function verifyHs256(signingInput: string, signature: Buffer, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(signingInput).digest()
  if (expected.length !== signature.length) return false
  return timingSafeEqual(expected, signature)
}

function isValidPayload(payload: any): payload is InternalTrustContext {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  if (payload.iss !== 'handshake-edge') return false
  if (payload.aud !== 'handshake-core') return false
  if (payload.sub !== 'policy.apply') return false
  if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) return false
  if (typeof payload.jti !== 'string' || payload.jti.trim().length < 8) return false
  if (payload.principalId !== undefined && (typeof payload.principalId !== 'string' || !payload.principalId.trim())) return false
  if (payload.traceId !== undefined && (typeof payload.traceId !== 'string' || !payload.traceId.trim())) return false
  return true
}

export function createInternalTrustToken(payload: InternalTrustContext, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const h = base64url(JSON.stringify(header))
  const p = base64url(JSON.stringify(payload))
  const signingInput = `${h}.${p}`
  const sig = createHmac('sha256', secret).update(signingInput).digest()
  return `${signingInput}.${base64url(sig)}`
}

export const requireInternalTrustContext: MiddlewareHandler<AppEnv> = async (c, next) => {
  const raw = c.req.header('x-internal-trust-context')
  if (!raw || !raw.trim()) {
    return c.json(toStructuredError('security_missing_internal_trust_context', 'Internal trust context required'), statusForReasonCode('security_missing_internal_trust_context'))
  }

  if (raw.length > MAX_TOKEN_BYTES) {
    return c.json(toStructuredError('security_invalid_internal_trust_context', 'Internal trust context exceeds size limit'), statusForReasonCode('security_invalid_internal_trust_context'))
  }

  const secret = c.env.INTERNAL_TRUST_SHARED_SECRET
  if (!secret || !secret.trim()) {
    return c.json(toStructuredError('security_internal_trust_config_missing', 'Internal trust config missing'), statusForReasonCode('security_internal_trust_config_missing'))
  }

  const parsed = parseInternalTrustToken(raw)
  if (!parsed) {
    return c.json(toStructuredError('security_invalid_internal_trust_context', 'Malformed internal trust context'), statusForReasonCode('security_invalid_internal_trust_context'))
  }

  if (!verifyHs256(parsed.signingInput, parsed.signature, secret)) {
    return c.json(toStructuredError('security_invalid_internal_trust_context', 'Internal trust signature invalid'), statusForReasonCode('security_invalid_internal_trust_context'))
  }

  if (!isValidPayload(parsed.payload)) {
    return c.json(toStructuredError('security_invalid_internal_trust_context', 'Internal trust payload invalid'), statusForReasonCode('security_invalid_internal_trust_context'))
  }

  const now = Date.now()
  const iatMs = parsed.payload.iat * 1000
  const expMs = parsed.payload.exp * 1000
  if (iatMs > now + SKEW_MS || expMs < now - SKEW_MS) {
    return c.json(toStructuredError('security_internal_trust_context_expired', 'Internal trust context expired or not yet valid'), statusForReasonCode('security_internal_trust_context_expired'))
  }

  const replayGuard = createReplayGuard(c.env)
  const replay = await replayGuard.reserve({
    scope: 'internal_trust_jti',
    key: parsed.payload.jti,
    ttlSeconds: JTI_TTL_SECONDS,
    nowMs: now,
  })

  if (!replay.ok) {
    if (replay.reason === 'replay_detected') {
      return c.json(toStructuredError('security_replay_detected', 'Internal trust token replay detected'), statusForReasonCode('security_replay_detected'))
    }
    return c.json(toStructuredError('security_replay_guard_unavailable', 'Replay guard unavailable'), statusForReasonCode('security_replay_guard_unavailable'))
  }

  c.set('internalTrustContext', parsed.payload)
  await next()
}
