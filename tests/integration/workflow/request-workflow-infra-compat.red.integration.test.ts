import { describe, it, expect } from 'vitest'
import { createRequestWorkflowService } from '@/domain/services/request-workflow.service'
import { DefaultInMemoryRequestWorkflowStore } from '@/domain/services/request-workflow-in-memory-store'
import { createHITLRequest, approveHITL, rejectHITL, timeoutHITL } from '@/domain/services/hitl-workflow'
import { getHITLRequest } from '@/domain/services/hitl-workflow'


function makeService() {
  return createRequestWorkflowService({
    requestStore: new DefaultInMemoryRequestWorkflowStore(),
    hitl: { create: createHITLRequest, approve: approveHITL, reject: rejectHITL, timeout: timeoutHITL },
    metrics: { incr: async () => {} },
    clock: { nowMs: () => Date.now() },
  })
}

describe('Request Workflow RED (infra compatibility)', () => {
  it('uses existing HITL workflow for escalations', async () => {
    const service = makeService()
    const out = await service.submitRequest({
      requestId: 'infra-1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'amount:700',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { amount: 700 }
    })

    expect(out.decision).toBe('escalate')
    expect(out.hitlRequestId).toBeTruthy()
    const req = await getHITLRequest(out.hitlRequestId!)
    expect(req).toBeTruthy()
    expect(req?.status).toBe('pending')
  })

  it('records audit trail for submit + resolution', async () => {
    const service = makeService()
    const out = await service.submitRequest({
      requestId: 'infra-2',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'amount:700',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { amount: 700 }
    })

    await service.resolveRequestHitl({
      requestId: out.requestId,
      hitlRequestId: out.hitlRequestId!,
      decision: 'timeout',
      timestamp: Date.now() + 600_000
    })

    const audit = await service.getRequestAudit(out.requestId)
    expect(audit.length).toBeGreaterThanOrEqual(2)
  })
})
