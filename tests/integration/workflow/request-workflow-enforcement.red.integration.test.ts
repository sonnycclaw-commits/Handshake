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

describe('Request Workflow RED (integration enforcement)', () => {
  it('RW-004: denies privileged bypass path', async () => {
    const out = await makeService().submitRequest({
      requestId: 'ri1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'credential_use',
      payloadRef: 'secret-op',
      timestamp: Date.now(),
      privilegedPath: false,
    })

    expect(out.decision).toBe('deny')
    expect(out.reasonCode).toMatch(/bypass|handshake_required/i)
  })

  it('RW-004b: denies side-channel adapter invocation attempts', async () => {
    const out = await makeService().submitRequest({
      requestId: 'ri1b',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'credential_use',
      payloadRef: 'secret-op',
      timestamp: Date.now(),
      privilegedPath: true,
      context: {
        sideChannelAttempt: true,
      }
    })

    expect(out.decision).toBe('deny')
    expect(out.reasonCode).toMatch(/side_channel|security_/i)
  })

  it('RW-007: same input/context yields same decision class', async () => {
    const req = {
      requestId: 'ri2',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'other' as const,
      payloadRef: 'safe-read',
      timestamp: Date.now(),
      privilegedPath: true,
    }

    const a = await makeService().submitRequest(req)
    const b = await makeService().submitRequest({ ...req, requestId: 'ri3' })

    expect(a.decision).toBe(b.decision)
  })
})
