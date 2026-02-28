import { describe, it, expect } from 'vitest'
import {
  REASON_CODE_SCHEMA_VERSION,
  isKnownReasonCode,
  assertKnownReasonCode,
  classifyReasonCode,
  toResponseClass,
} from '@/domain/constants/reason-codes'

describe('Reason Code Registry (C5)', () => {
  it('exposes versioned reason-code schema', () => {
    expect(REASON_CODE_SCHEMA_VERSION).toBe('v2')
  })

  it('accepts known reason codes', () => {
    expect(isKnownReasonCode('policy_allow')).toBe(true)
    expect(() => assertKnownReasonCode('security_side_channel_denied')).not.toThrow()
  })

  it('rejects unknown reason codes', () => {
    expect(isKnownReasonCode('policy_new_unreviewed_code')).toBe(false)
    expect(() => assertKnownReasonCode('policy_new_unreviewed_code')).toThrow(/UNKNOWN_REASON_CODE/)
  })

  it('classifies reason-code families', () => {
    expect(classifyReasonCode('trust_context_missing_binding')).toBe('trust_context')
    expect(classifyReasonCode('policy_allow')).toBe('policy')
    expect(classifyReasonCode('security_non_allow_artifact')).toBe('security')
    expect(classifyReasonCode('hitl_approved')).toBe('hitl')
    expect(classifyReasonCode('adapter_timeout')).toBe('adapter')
    expect(classifyReasonCode('x_custom')).toBe('unknown')
  })

  it('normalizes decision+reason to response classes', () => {
    expect(toResponseClass({ decision: 'allow', reasonCode: 'policy_allow' })).toBe('ok')
    expect(toResponseClass({ decision: 'deny', reasonCode: 'security_side_channel_denied' })).toBe('blocked')
    expect(toResponseClass({ decision: 'escalate', reasonCode: 'hitl_boundary_escalated' })).toBe('retryable')
    expect(toResponseClass({ decision: 'deny', reasonCode: 'hitl_rejected' })).toBe('blocked')
    expect(toResponseClass({ decision: 'deny', reasonCode: 'brand_new_unknown_code' })).toBe('unknown')
  })
})
