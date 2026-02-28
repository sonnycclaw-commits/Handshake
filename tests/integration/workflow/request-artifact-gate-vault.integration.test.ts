import { describe, it, expect } from 'vitest'
import { executePrivilegedAction } from '../../../../src/use-cases/execute-privileged-action'
import { submitRequest } from '../../../../src/domain/services/request-workflow'
import { InMemoryVault } from '../../../../src/adapters/vault/in-memory-vault'

describe('Artifact gate + vault integration (C6)', () => {
  it('denies vault execution when artifact is tampered', async () => {
    const vault = new InMemoryVault()
    await vault.connect({ type: 'in-memory', credentials: {} })

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

    const artifact = await submitRequest(request)
    const tampered = { ...artifact, decisionContextHash: 'ctx_tampered' }

    const out = await executePrivilegedAction({
      request,
      artifact: tampered,
      credentialId: 'cred_payment_001',
      action: { type: 'read', params: {} },
      executionContext: { agentId: 'a1', principalId: 'principal_001', timestamp: Date.now() }
    }, { vault })

    expect(out.allowed).toBe(false)
    expect(out.gateReasonCode).toMatch(/context_mismatch|security_/)
  })
})
