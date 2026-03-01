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

describe('Request Workflow RED (sensitive branch)', () => {
  it('denies unauthorized sensitive scope', async () => {
    const out = await makeService().submitRequest({
      requestId: 'sens-1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'data_access',
      payloadRef: 'customer-phi',
      timestamp: Date.now(),
      privilegedPath: true,
      context: {
        authorizedSensitiveScope: false,
        sensitivity: 'high'
      }
    })

    expect(out.decision).toBe('deny')
    expect(out.reasonCode).toMatch(/policy_|security_/)
  })

  it('escalates ambiguous sensitive request', async () => {
    const out = await makeService().submitRequest({
      requestId: 'sens-2',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'data_access',
      payloadRef: 'customer-record',
      timestamp: Date.now(),
      privilegedPath: true,
      context: {
        sensitivity: 'ambiguous'
      }
    })

    expect(out.decision).toBe('escalate')
    expect(out.hitlRequestId).toBeTruthy()
  })
})
