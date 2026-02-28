import { describe, it, expect } from 'vitest'
import { submitRequest } from '../../../../src/domain/services/request-workflow'

describe('Request Decision Context RED (unit)', () => {
  it('produces stable decisionContextHash for same normalized context', async () => {
    const baseTs = Date.now()
    const a = await submitRequest({
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

    const b = await submitRequest({
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
