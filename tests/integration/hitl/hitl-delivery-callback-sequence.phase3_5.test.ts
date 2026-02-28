import { describe, it, expect } from 'vitest'
import { createHITLRequest, timeoutHITL } from '@/domain/services/hitl-workflow'
import { verifyAndApplyHITLCallback } from '@/domain/services/hitl-callback-verification'

describe('HITL Delivery + Callback Sequence (phase 3.5)', () => {
  it('accepts valid callback and transitions pending -> approved', async () => {
    const req = await createHITLRequest({ agentId: 'a', principalId: 'principal_001', tier: 3, action: 'payment' })

    const result = await verifyAndApplyHITLCallback({
      requestId: req.id,
      actorId: 'principal_001',
      signature: 'valid-signature',
      decision: 'approved'
    })

    expect(result.accepted).toBe(true)
    expect(result.state).toBe('approved')
  })

  it('rejects callback for expired request (timeout already applied)', async () => {
    const req = await createHITLRequest({ agentId: 'a', principalId: 'principal_001', tier: 3, action: 'payment' })
    const timedOut = await timeoutHITL(req.id)
    expect(timedOut.status).toBe('rejected')

    const result = await verifyAndApplyHITLCallback({
      requestId: req.id,
      actorId: 'principal_001',
      signature: 'valid-signature',
      decision: 'approved'
    })

    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('terminal_state')
  })
})
