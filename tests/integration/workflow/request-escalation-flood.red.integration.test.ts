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

describe('Request Workflow RED (escalation flood control)', () => {
  it('throttles repeated escalations from same agent/principal tuple', async () => {
    const service = makeService()
    const principalId = 'p-flood'
    const agentId = 'a-flood'

    let throttled = false
    for (let i = 0; i < 8; i++) {
      const out = await service.submitRequest({
        requestId: `flood-${i}`,
        principalId,
        agentId,
        actionType: 'payment',
        payloadRef: 'amount:999',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 999 }
      })

      if (out.decision === 'deny' && out.reasonCode.startsWith('security_escalation_flood_')) {
        throttled = true
      }
    }

    expect(throttled).toBe(true)
  })
})
