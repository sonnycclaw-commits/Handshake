import { describe, it, expect } from 'vitest'
import { createRequestWorkflowService } from '@/domain/services/request-workflow.service'
import { DefaultInMemoryRequestWorkflowStore } from '@/domain/services/request-workflow-in-memory-store'
import { createHITLRequest, approveHITL, rejectHITL, timeoutHITL } from '@/domain/services/hitl-workflow'
import { getRetryPolicyForReason } from '@/domain/services/request-retry-policy'


function makeService() {
  return createRequestWorkflowService({
    requestStore: new DefaultInMemoryRequestWorkflowStore(),
    hitl: { create: createHITLRequest, approve: approveHITL, reject: rejectHITL, timeout: timeoutHITL },
    metrics: { incr: async () => {} },
    clock: { nowMs: () => Date.now() },
  })
}

describe('Request Workflow RED (agent contract stability)', () => {
  it('maps deny reason classes to deterministic retry policy', async () => {
    const denied = await makeService().submitRequest({
      requestId: 'acs-1',
      principalId: '',
      agentId: 'a1',
      actionType: 'other',
      payloadRef: 'x',
      timestamp: Date.now(),
      privilegedPath: true,
    } as any)

    expect(denied.decision).toBe('deny')
    expect(denied.responseClass).toBe('blocked')
    const policy = getRetryPolicyForReason(denied.reasonCode)
    expect(policy.decision).toMatch(/retry_after_remediation|do_not_retry/)
  })

  it('fails closed for unknown reason classes', () => {
    const p = getRetryPolicyForReason('brand_new_unknown_code')
    expect(p.decision).toBe('do_not_retry')
    expect(p.maxRetries).toBe(0)
  })
})
