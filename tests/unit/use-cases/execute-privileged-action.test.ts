import { describe, it, expect } from 'vitest'
import { executePrivilegedAction } from '@/use-cases/execute-privileged-action'
import { createRequestWorkflowService } from '@/domain/services/request-workflow.service'
import { DefaultInMemoryRequestWorkflowStore } from '@/domain/services/request-workflow-in-memory-store'
import { createHITLRequest, approveHITL, rejectHITL, timeoutHITL } from '@/domain/services/hitl-workflow'
import type { VaultAdapter } from '@/ports/types'

class MockVault implements VaultAdapter {
  readonly name = 'mock-vault'
  readonly version = '1.0.0'
  calls = 0

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async health() { return { connected: true, lastCheck: Date.now() } }
  async listCredentials() { return [] }

  async execute() {
    this.calls += 1
    return {
      success: true,
      transactionId: `txn_${Date.now()}`,
      timestamp: Date.now(),
      details: { ok: true }
    }
  }
}

function makeWorkflowService() {
  return createRequestWorkflowService({
    requestStore: new DefaultInMemoryRequestWorkflowStore(),
    hitl: { create: createHITLRequest, approve: approveHITL, reject: rejectHITL, timeout: timeoutHITL },
    metrics: { incr: async () => {} },
    clock: { nowMs: () => Date.now() },
  })
}

describe('executePrivilegedAction (C6)', () => {
  it('blocks privileged execution without valid artifact', async () => {
    const vault = new MockVault()
    const workflowService = makeWorkflowService()

    const request = {
      requestId: 'c6-1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'other' as const,
      payloadRef: 'safe-op',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { policyVersion: 'pv1', trustSnapshotId: 'ts1' }
    }

    const out = await executePrivilegedAction({
      request,
      artifact: null,
      credentialId: 'cred_1',
      action: { type: 'noop', params: {} },
      executionContext: { agentId: 'a1', principalId: 'p1', timestamp: Date.now() }
    }, { vault, workflowService })

    expect(out.allowed).toBe(false)
    expect(out.responseClass).toBe('blocked')
    expect(vault.calls).toBe(0)
  })

  it('allows execution only with valid allow artifact', async () => {
    const vault = new MockVault()
    const workflowService = makeWorkflowService()

    const request = {
      requestId: 'c6-2',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'other' as const,
      payloadRef: 'safe-op',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { policyVersion: 'pv1', trustSnapshotId: 'ts1' }
    }

    const artifact = await workflowService.submitRequest(request)
    expect(artifact.decision).toBe('allow')

    const out = await executePrivilegedAction({
      request,
      artifact,
      credentialId: 'cred_1',
      action: { type: 'noop', params: {} },
      executionContext: { agentId: 'a1', principalId: 'p1', timestamp: Date.now() }
    }, { vault, workflowService })

    expect(out.allowed).toBe(true)
    expect(out.responseClass).toBe('ok')
    expect(vault.calls).toBe(1)
    expect(out.result?.success).toBe(true)
  })
})
