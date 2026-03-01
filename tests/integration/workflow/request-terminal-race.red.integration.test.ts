import { describe, it, expect } from 'vitest'
import { createRequestWorkflowService } from '@/domain/services/request-workflow.service'
import { DefaultInMemoryRequestWorkflowStore } from '@/domain/services/request-workflow-in-memory-store'
import { createHITLRequest, approveHITL, rejectHITL, timeoutHITL } from '@/domain/services/hitl-workflow'


function makeService() {
  return createRequestWorkflowService({
    requestStore: new DefaultInMemoryRequestWorkflowStore(),
    hitl: { create: createHITLRequest, approve: approveHITL, reject: rejectHITL, timeout: timeoutHITL },
    metrics: { incr: async () => {} },
    clock: { nowMs: () => Date.now() },
  })
}

describe('Request Workflow RED (terminal race)', () => {
  it('preserves terminal immutability under callback race', async () => {
    const service = makeService()
    const out = await service.submitRequest({
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

    const timeout = await service.resolveRequestHitl({
      requestId: out.requestId,
      hitlRequestId: out.hitlRequestId!,
      decision: 'timeout',
      timestamp: Date.now() + 600_000,
    })
    expect(timeout.decision).toBe('deny')

    const lateApprove = await service.resolveRequestHitl({
      requestId: out.requestId,
      hitlRequestId: out.hitlRequestId!,
      decision: 'approve',
      timestamp: Date.now() + 600_001,
    })

    expect(lateApprove.decision).toBe('deny')
    expect(lateApprove.reasonCode).toMatch(/terminal|immutable|fail_closed/i)
  })
})
