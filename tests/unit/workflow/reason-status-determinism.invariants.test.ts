import { describe, it, expect } from 'vitest'
import { statusForReasonCodeStrict } from '@/domain/constants/reason-code-http'
import { toResponseClass } from '@/domain/constants/reason-codes'

describe('W4-D3 invariant: reason/status/responseClass determinism', () => {
  it('maps equivalent tenant/read authz failures deterministically', () => {
    const reasons = ['security_read_scope_denied', 'security_read_tenant_mismatch'] as const

    for (const reason of reasons) {
      expect(statusForReasonCodeStrict(reason)).toBe(403)
      expect(toResponseClass({ decision: 'deny', reasonCode: reason })).toBe('blocked')
    }
  })

  it('replay guard failure classes remain deterministic fail-closed statuses', () => {
    expect(statusForReasonCodeStrict('security_replay_detected')).toBe(409)
    expect(statusForReasonCodeStrict('security_replay_guard_unavailable')).toBe(503)

    expect(toResponseClass({ decision: 'deny', reasonCode: 'security_replay_detected' })).toBe('blocked')
    expect(toResponseClass({ decision: 'deny', reasonCode: 'security_replay_guard_unavailable' })).toBe('blocked')
  })
})
