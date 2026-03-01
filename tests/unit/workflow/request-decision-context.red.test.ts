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

describe('Request Decision Context RED (unit)', () => {
  it('produces stable decisionContextHash for same normalized context', async () => {
    const baseTs = Date.now()
    const a = await makeService().submitRequest({
      requestId: 'ctx-1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'amount:50',
      timestamp: baseTs,
      privilegedPath: true,
      context: {
        amount: 50,
        category: 'ops',
        policyVersion: 'pv1',
        trustSnapshotId: 'ts1'
      }
    })

    const b = await makeService().submitRequest({
      requestId: 'ctx-2',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'amount:50',
      timestamp: baseTs + 500,
      privilegedPath: true,
      context: {
        amount: 50,
        category: 'ops',
        policyVersion: 'pv1',
        trustSnapshotId: 'ts1'
      }
    })

    expect(a.decisionContextHash).toBeTruthy()
    expect(a.decisionContextHash).toBe(b.decisionContextHash)
    expect(a.decision).toBe(b.decision)
  })
})
