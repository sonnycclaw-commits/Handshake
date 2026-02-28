import { describe, it, expect } from 'vitest'
import { submitRequest } from '../../../../src/domain/services/request-workflow'

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

    const api = await submitRequest({ ...base, requestId: 'surf-api', context: { ...base.context, channel: 'api' } })
    const chat = await submitRequest({ ...base, requestId: 'surf-chat', context: { ...base.context, channel: 'chat' } })
    const wf = await submitRequest({ ...base, requestId: 'surf-wf', context: { ...base.context, channel: 'workflow' } })

    expect(api.decision).toBe(chat.decision)
    expect(chat.decision).toBe(wf.decision)
    expect(api.decisionContextHash).toBe(chat.decisionContextHash)
    expect(chat.decisionContextHash).toBe(wf.decisionContextHash)
  })
})
