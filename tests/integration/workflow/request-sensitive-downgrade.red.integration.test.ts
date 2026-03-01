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

describe('Request Workflow RED (sensitive downgrade defense)', () => {
  it('ignores low-risk self-label when payload indicates sensitive operation', async () => {
    const out = await makeService().submitRequest({
      requestId: 'sd-1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'data_access',
      payloadRef: 'patient_phi_record',
      timestamp: Date.now(),
      privilegedPath: true,
      context: {
        riskLabel: 'low',
        sensitivity: 'high',
        authorizedSensitiveScope: false
      }
    })

    expect(out.decision).toBe('deny')
    expect(out.reasonCode).toMatch(/policy_sensitive_scope_denied|security_/)
  })
})
