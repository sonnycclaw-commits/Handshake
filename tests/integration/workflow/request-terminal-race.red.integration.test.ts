import { describe, it, expect } from 'vitest'
import { submitRequest, resolveRequestHitl } from '@/domain/services/request-workflow'

describe('Request Workflow RED (terminal race)', () => {
  it('preserves terminal immutability under callback race', async () => {
    const out = await submitRequest({
      requestId: 'race-1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'amount:500',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { amount: 500 }
    })

    expect(out.decision).toBe('escalate')

    const timeout = await resolveRequestHitl({
      requestId: out.requestId,
      hitlRequestId: out.hitlRequestId!,
      decision: 'timeout',
      timestamp: Date.now() + 600_000,
    })
    expect(timeout.decision).toBe('deny')

    const lateApprove = await resolveRequestHitl({
      requestId: out.requestId,
      hitlRequestId: out.hitlRequestId!,
      decision: 'approve',
      timestamp: Date.now() + 600_001,
    })

    expect(lateApprove.decision).toBe('deny')
    expect(lateApprove.reasonCode).toMatch(/terminal|immutable|fail_closed/i)
  })
})
