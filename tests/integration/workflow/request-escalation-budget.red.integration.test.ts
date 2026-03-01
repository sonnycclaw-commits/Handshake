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

describe('Request Workflow RED (escalation budget)', () => {
  it('preserves low-risk auto path while throttling excessive escalations', async () => {
    const service = makeService()
    // low risk should still allow
    const low = await service.submitRequest({
      requestId: 'eb-low-1',
      principalId: 'p-budget',
      agentId: 'a-budget',
      actionType: 'other',
      payloadRef: 'safe-read',
      timestamp: Date.now(),
      privilegedPath: true,
    })
    expect(low.decision).toBe('allow')

    // spam escalation path
    let deniedForFlood = 0
    for (let i = 0; i < 10; i++) {
      const out = await service.submitRequest({
        requestId: `eb-hi-${i}`,
        principalId: 'p-budget',
        agentId: 'a-budget',
        actionType: 'payment',
        payloadRef: 'amount:999',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 999 },
      })
      if (out.reasonCode.startsWith('security_escalation_flood_')) deniedForFlood++
    }

    expect(deniedForFlood).toBeGreaterThan(0)
  })
})
