import { describe, it, expect } from 'vitest'
import { getRetryPolicyForReason } from '../../../../src/domain/services/request-retry-policy'

describe('Request Retry Policy', () => {
  it('fails closed for unknown reason codes', () => {
    const out = getRetryPolicyForReason('some_new_unmapped_code')
    expect(out.decision).toBe('do_not_retry')
    expect(out.maxRetries).toBe(0)
  })

  it('forbids automatic retry for security and terminal states', () => {
    const sec = getRetryPolicyForReason('security_handshake_required_bypass_denied')
    const terminal = getRetryPolicyForReason('hitl_terminal_state_immutable')

    expect(sec.decision).toBe('do_not_retry')
    expect(terminal.decision).toBe('do_not_retry')
  })

  it('requires remediation for trust and policy denials', () => {
    const trust = getRetryPolicyForReason('trust_context_missing_binding')
    const policy = getRetryPolicyForReason('policy_sensitive_scope_denied')

    expect(trust.decision).toBe('retry_after_remediation')
    expect(policy.decision).toBe('retry_after_remediation')
  })

  it('allows bounded backoff for adapter/provider transient failures', () => {
    const adapter = getRetryPolicyForReason('adapter_timeout')
    expect(adapter.decision).toBe('retry_with_backoff')
    expect(adapter.maxRetries).toBeGreaterThan(0)
  })
})
