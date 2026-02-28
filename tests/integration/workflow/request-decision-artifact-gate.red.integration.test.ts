import { describe, it, expect } from 'vitest'
import { submitRequest, authorizePrivilegedExecution } from '../../../../src/domain/services/request-workflow'

describe('Request Workflow RED (decision artifact gate)', () => {
  it('RW-011: denies privileged execution without artifact', async () => {
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

    const out = await authorizePrivilegedExecution({ request, artifact: null })
    expect(out.allowed).toBe(false)
    expect(out.reasonCode).toMatch(/missing_decision_artifact/i)
  })

  it('RW-011: denies privileged continuation from non-allow artifact', async () => {
    const denied = await submitRequest({
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
    const out = await authorizePrivilegedExecution({ request, artifact: denied })

    expect(denied.decision).toBe('deny')
    expect(out.allowed).toBe(false)
    expect(out.reasonCode).toMatch(/non_allow|state_not_authorized|context_mismatch/i)
  })

  it('RW-011: denies artifact with mismatched decisionContextHash', async () => {
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

    const allowed = await submitRequest(request)
    expect(allowed.decision).toBe('allow')

    const tampered = { ...allowed, decisionContextHash: 'ctx_tampered' }
    const gate = await authorizePrivilegedExecution({ request, artifact: tampered })

    expect(gate.allowed).toBe(false)
    expect(gate.reasonCode).toMatch(/context_mismatch/i)
  })

  it('RW-011: allows privileged execution with valid allow artifact and context hash', async () => {
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

    const allowed = await submitRequest(request)
    expect(allowed.decision).toBe('allow')

    const gate = await authorizePrivilegedExecution({ request, artifact: allowed })
    expect(gate.allowed).toBe(true)
  })
})
