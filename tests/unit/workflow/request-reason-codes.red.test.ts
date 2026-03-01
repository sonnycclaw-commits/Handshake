import { describe, it, expect } from 'vitest'
import { submitRequest } from '@/domain/services/request-workflow-api'

describe('Request Reason Codes RED (unit)', () => {
  it('returns standardized security_* reason code for bypass', async () => {
    const out = await submitRequest({
      requestId: 'rc-1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'credential_use',
      payloadRef: 'x',
      timestamp: Date.now(),
      privilegedPath: false,
    })

    expect(out.decision).toBe('deny')
    expect(out.reasonCode.startsWith('security_')).toBe(true)
  })

  it('returns standardized hitl_* reason code on timeout path', async () => {
    const escalated = await submitRequest({
      requestId: 'rc-2',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'amount:999',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { amount: 999 }
    })

    expect(escalated.decision).toBe('escalate')

    // Timeout resolution tested in integration; here we only ensure escalate reason taxonomy
    expect(escalated.reasonCode.startsWith('hitl_')).toBe(true)
  })
})
