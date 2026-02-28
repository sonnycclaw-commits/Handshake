export const REASON_CODE_SCHEMA_VERSION = 'v2'

export const KNOWN_REASON_CODES = [
  // trust context
  'trust_context_invalid_request_shape',
  'trust_context_missing_binding',
  'trust_context_invalid_timestamp',
  'trust_context_timestamp_skew_fail_closed',

  // policy
  'policy_allow',
  'policy_sensitive_scope_denied',
  'policy_invalid_policy',
  'policy_invalid_request',
  'policy_daily_limit_exceeded',
  'policy_category_not_allowed',
  'policy_outside_allowed_hours',
  'policy_max_transaction_exceeded',
  'policy_denied',

  // security
  'security_handshake_required_bypass_denied',
  'security_side_channel_denied',
  'security_escalation_flood_throttled',
  'security_missing_decision_artifact',
  'security_non_allow_artifact',
  'security_decision_context_mismatch',
  'security_artifact_request_not_found',
  'security_artifact_state_not_authorized',
  'security_artifact_authorized',

  // clerk identity
  'security_missing_authorization_header',
  'security_identity_claim_missing',
  'security_token_invalid',
  'security_identity_provider_not_configured',

  // hitl
  'hitl_sensitive_ambiguous_escalated',
  'hitl_boundary_escalated',
  'hitl_request_not_found',
  'hitl_request_mismatch',
  'hitl_terminal_state_immutable',
  'hitl_timeout_fail_closed',
  'hitl_rejected',
  'hitl_approval_unauthorized',
  'hitl_approved',
] as const

const KNOWN_SET = new Set<string>(KNOWN_REASON_CODES)

export type ReasonCodeClass = 'trust_context' | 'policy' | 'security' | 'hitl' | 'adapter' | 'unknown'

export function isKnownReasonCode(code: string): boolean {
  return KNOWN_SET.has(code)
}

export function assertKnownReasonCode(code: string): void {
  if (!isKnownReasonCode(code)) {
    throw new Error(`UNKNOWN_REASON_CODE:${code}`)
  }
}

export function classifyReasonCode(code: string): ReasonCodeClass {
  const normalized = String(code || '').trim().toLowerCase()
  if (normalized.startsWith('trust_context_')) return 'trust_context'
  if (normalized.startsWith('policy_')) return 'policy'
  if (normalized.startsWith('security_')) return 'security'
  if (normalized.startsWith('hitl_')) return 'hitl'
  if (normalized.startsWith('adapter_')) return 'adapter'
  return 'unknown'
}

export type ResponseClass = 'ok' | 'retryable' | 'blocked' | 'unknown'

/**
 * Canonical response normalization for agent runtimes.
 * - ok: allow / authorized outcomes
 * - retryable: transient adapter/infrastructure/time-window retry candidates
 * - blocked: fail-closed or policy/security/HITL gates requiring remediation
 * - unknown: non-registered reason (must be treated fail-closed by caller)
 */
export function toResponseClass(input: {
  decision?: 'allow' | 'deny' | 'escalate'
  reasonCode: string
}): ResponseClass {
  const reasonCode = String(input.reasonCode || '').trim()
  if (!isKnownReasonCode(reasonCode)) return 'unknown'

  if (input.decision === 'allow') return 'ok'

  const family = classifyReasonCode(reasonCode)
  if (family === 'trust_context' || family === 'policy' || family === 'security') return 'blocked'

  if (family === 'hitl') {
    if (reasonCode.endsWith('_escalated')) return 'retryable'
    if (reasonCode === 'hitl_approved') return 'ok'
    return 'blocked'
  }

  if (family === 'adapter') return 'retryable'
  return 'unknown'
}
