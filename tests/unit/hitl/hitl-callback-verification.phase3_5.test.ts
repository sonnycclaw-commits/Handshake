import { describe, it, expect } from 'vitest'
import { verifyAndApplyHITLCallback } from '../../../../src/domain/services/hitl-callback-verification'

describe('Phase 3.5 RED: HITL Callback Verification', () => {
  it('rejects unauthorized callback actor', async () => {
    const res = await verifyAndApplyHITLCallback({
      requestId: 'hitl_010',
      decision: 'approved',
      actorId: 'principal_unauthorized',
      timestamp: Date.now(),
      signature: 'valid-looking-signature'
    } as any)

    expect(res.accepted).toBe(false)
    expect(res.reason).toBe('unauthorized_actor')
  })

  it('rejects invalid callback signature/proof', async () => {
    const res = await verifyAndApplyHITLCallback({
      requestId: 'hitl_011',
      decision: 'approved',
      actorId: 'principal_001',
      timestamp: Date.now(),
      signature: 'invalid'
    } as any)

    expect(res.accepted).toBe(false)
    expect(res.reason).toBe('invalid_signature')
  })

  it('is idempotent for duplicate callbacks', async () => {
    const payload: any = {
      requestId: 'hitl_012',
      decision: 'approved',
      actorId: 'principal_001',
      timestamp: Date.now(),
      signature: 'valid-signature'
    }

    const first = await verifyAndApplyHITLCallback(payload)
    const second = await verifyAndApplyHITLCallback(payload)

    expect(first.accepted).toBe(true)
    expect(second.accepted).toBe(false)
    expect(second.reason).toBe('duplicate')
  })

  it('ignores late callback after timeout terminal state', async () => {
    const res = await verifyAndApplyHITLCallback({
      requestId: 'hitl_013_timed_out',
      decision: 'approved',
      actorId: 'principal_001',
      timestamp: Date.now(),
      signature: 'valid-signature'
    } as any)

    expect(res.accepted).toBe(false)
    expect(res.reason).toBe('terminal_state')
  })
})
