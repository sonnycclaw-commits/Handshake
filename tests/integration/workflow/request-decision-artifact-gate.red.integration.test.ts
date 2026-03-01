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

describe('Request Workflow RED (decision artifact gate)', () => {
  it('RW-011: denies privileged execution without artifact', async () => {
    const service = makeService()
    const request = {
      requestId: 'dag-0',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'other' as const,
      payloadRef: 'safe-op',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { policyVersion: 'pv1', trustSnapshotId: 'ts1' }
    }

    const out = await service.authorizePrivilegedExecution({ request, artifact: null })
    expect(out.allowed).toBe(false)
    expect(out.reasonCode).toMatch(/missing_decision_artifact/i)
  })

  it('RW-011: denies privileged continuation from non-allow artifact', async () => {
    const service = makeService()
    const denied = await service.submitRequest({
      requestId: 'dag-1',
      principalId: '',
      agentId: 'a1',
      actionType: 'credential_use',
      payloadRef: 'secret-op',
      timestamp: Date.now(),
      privilegedPath: true,
    } as any)

    const request = {
      requestId: denied.requestId,
      principalId: denied.requestId,
      agentId: 'a1',
      actionType: 'credential_use' as const,
      payloadRef: 'secret-op',
      timestamp: Date.now(),
      privilegedPath: true,
      context: {}
    }
    const out = await service.authorizePrivilegedExecution({ request, artifact: denied })

    expect(denied.decision).toBe('deny')
    expect(out.allowed).toBe(false)
    expect(out.reasonCode).toMatch(/non_allow|state_not_authorized|context_mismatch/i)
  })

  it('RW-011: denies artifact with mismatched decisionContextHash', async () => {
    const service = makeService()
    const request = {
      requestId: 'dag-2',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'other' as const,
      payloadRef: 'safe-op',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { policyVersion: 'pv1', trustSnapshotId: 'ts1' }
    }

    const allowed = await service.submitRequest(request)
    expect(allowed.decision).toBe('allow')

    const tampered = { ...allowed, decisionContextHash: 'ctx_tampered' }
    const gate = await service.authorizePrivilegedExecution({ request, artifact: tampered })

    expect(gate.allowed).toBe(false)
    expect(gate.reasonCode).toMatch(/context_mismatch/i)
  })

  it('RW-011: allows privileged execution with valid allow artifact and context hash', async () => {
    const service = makeService()
    const request = {
      requestId: 'dag-3',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'other' as const,
      payloadRef: 'safe-op',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { policyVersion: 'pv1', trustSnapshotId: 'ts1' }
    }

    const allowed = await service.submitRequest(request)
    expect(allowed.decision).toBe('allow')

    const gate = await service.authorizePrivilegedExecution({ request, artifact: allowed })
    expect(gate.allowed).toBe(true)
  })
})
