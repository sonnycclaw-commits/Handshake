import { KNOWN_REASON_CODES } from './reason-codes'

export type HttpErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 503

const MAP: Record<string, HttpErrorStatus> = {
  trust_context_invalid_request_shape: 400,
  trust_context_missing_binding: 400,
  trust_context_invalid_timestamp: 400,
  trust_context_timestamp_skew_fail_closed: 400,

  policy_sensitive_scope_denied: 422,
  policy_invalid_policy: 422,
  policy_invalid_request: 422,
  policy_daily_limit_exceeded: 422,
  policy_category_not_allowed: 422,
  policy_outside_allowed_hours: 422,
  policy_max_transaction_exceeded: 422,
  policy_denied: 422,

  security_handshake_required_bypass_denied: 403,
  security_side_channel_denied: 403,
  security_escalation_flood_throttled: 403,
  security_missing_decision_artifact: 403,
  security_non_allow_artifact: 403,
  security_decision_context_mismatch: 409,
  security_artifact_request_not_found: 404,
  security_artifact_state_not_authorized: 409,
  security_artifact_authorized: 403,

  security_missing_authorization_header: 401,
  security_identity_claim_missing: 401,
  security_token_invalid: 401,
  security_identity_provider_not_configured: 401,
  security_missing_identity_envelope: 401,
  security_invalid_identity_envelope: 401,
  security_identity_envelope_required: 401,
  security_identity_subject_mismatch: 403,
  security_missing_internal_trust_context: 401,
  security_invalid_internal_trust_context: 401,
  security_internal_trust_context_expired: 401,
  security_internal_trust_config_missing: 401,
  security_replay_detected: 409,
  security_replay_guard_unavailable: 503,
  security_read_scope_denied: 403,
  security_read_tenant_mismatch: 403,

  hitl_sensitive_ambiguous_escalated: 409,
  hitl_boundary_escalated: 409,
  hitl_request_not_found: 404,
  hitl_request_mismatch: 409,
  hitl_terminal_state_immutable: 409,
  hitl_timeout_fail_closed: 409,
  hitl_rejected: 409,
  hitl_approval_unauthorized: 403,
  hitl_approved: 409,

  policy_allow: 400,
}

export function statusForReasonCodeStrict(reasonCode: string): HttpErrorStatus {
  const code = String(reasonCode || '').trim()
  const mapped = MAP[code]
  if (mapped) return mapped

  const known = new Set<string>(KNOWN_REASON_CODES as unknown as string[])
  if (known.has(code)) {
    throw new Error(`UNMAPPED_KNOWN_REASON_CODE:${code}`)
  }
  return 400
}

export function assertReasonCodeStatusMapComplete(): void {
  const known = new Set<string>(KNOWN_REASON_CODES as unknown as string[])
  const missing = [...known].filter((c) => !(c in MAP))
  if (missing.length > 0) {
    throw new Error(`UNMAPPED_REASON_CODES:${missing.join(',')}`)
  }
}
