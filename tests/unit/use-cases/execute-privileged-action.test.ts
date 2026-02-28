import { describe, it, expect } from 'vitest'
import { executePrivilegedAction } from '../../../../src/use-cases/execute-privileged-action'
import { submitRequest } from '../../../../src/domain/services/request-workflow'
import type { VaultAdapter } from '../../../../src/ports/types'

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

describe('executePrivilegedAction (C6)', () => {
  it('blocks privileged execution without valid artifact', async () => {
    const vault = new MockVault()

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
    }, { vault })

    expect(out.allowed).toBe(false)
    expect(out.responseClass).toBe('blocked')
    expect(vault.calls).toBe(0)
  })

  it('allows execution only with valid allow artifact', async () => {
    const vault = new MockVault()

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

    const artifact = await submitRequest(request)
    expect(artifact.decision).toBe('allow')

    const out = await executePrivilegedAction({
      request,
      artifact,
      credentialId: 'cred_1',
      action: { type: 'noop', params: {} },
      executionContext: { agentId: 'a1', principalId: 'p1', timestamp: Date.now() }
    }, { vault })

    expect(out.allowed).toBe(true)
    expect(out.responseClass).toBe('ok')
    expect(vault.calls).toBe(1)
    expect(out.result?.success).toBe(true)
  })
})
