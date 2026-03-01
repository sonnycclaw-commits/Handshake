import { describe, it, expect } from 'vitest'
import { executePrivilegedAction } from '@/use-cases/execute-privileged-action'
import { createRequestWorkflowService } from '@/domain/services/request-workflow.service'
import { DefaultInMemoryRequestWorkflowStore } from '@/domain/services/request-workflow-in-memory-store'
import { createHITLRequest, approveHITL, rejectHITL, timeoutHITL } from '@/domain/services/hitl-workflow'
import { InMemoryVault } from '@/adapters/vault/in-memory-vault'

function makeWorkflowService() {
  return createRequestWorkflowService({
    requestStore: new DefaultInMemoryRequestWorkflowStore(),
    hitl: { create: createHITLRequest, approve: approveHITL, reject: rejectHITL, timeout: timeoutHITL },
    metrics: { incr: async () => {} },
    clock: { nowMs: () => Date.now() },
  })
}

describe('Artifact gate + vault integration (C6)', () => {
  it('denies vault execution when artifact is tampered', async () => {
    const vault = new InMemoryVault()
    await vault.connect({ type: 'in-memory', credentials: {} })
    const workflowService = makeWorkflowService()

    const request = {
      requestId: 'c6i-1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'other' as const,
      payloadRef: 'safe-op',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { policyVersion: 'pv1', trustSnapshotId: 'ts1' }
    }

    const artifact = await workflowService.submitRequest(request)
    const tampered = { ...artifact, decisionContextHash: 'ctx_tampered' }

    const out = await executePrivilegedAction({
      request,
      artifact: tampered,
      credentialId: 'cred_payment_001',
      action: { type: 'read', params: {} },
      executionContext: { agentId: 'a1', principalId: 'principal_001', timestamp: Date.now() }
    }, { vault, workflowService })

    expect(out.allowed).toBe(false)
    expect(out.gateReasonCode).toMatch(/context_mismatch|security_/)
  })
})
