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

describe('Request Workflow RED (cross-surface parity)', () => {
  it('same context hash yields same decision across api/chat/workflow surfaces', async () => {
    const ts = Date.now()
    const base = {
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment' as const,
      payloadRef: 'amount:20',
      timestamp: ts,
      privilegedPath: true,
      context: {
        amount: 20,
        policyVersion: 'pv1',
        trustSnapshotId: 'ts1'
      }
    }

    const api = await makeService().submitRequest({ ...base, requestId: 'surf-api', context: { ...base.context, channel: 'api' } })
    const chat = await makeService().submitRequest({ ...base, requestId: 'surf-chat', context: { ...base.context, channel: 'chat' } })
    const wf = await makeService().submitRequest({ ...base, requestId: 'surf-wf', context: { ...base.context, channel: 'workflow' } })

    expect(api.decision).toBe(chat.decision)
    expect(chat.decision).toBe(wf.decision)
    expect(api.decisionContextHash).toBe(chat.decisionContextHash)
    expect(chat.decisionContextHash).toBe(wf.decisionContextHash)
  })
})
