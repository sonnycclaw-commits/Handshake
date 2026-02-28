import { describe, it, expect } from 'vitest'
import { submitRequest } from '../../../../src/domain/services/request-workflow'

describe('Request Workflow RED (escalation budget)', () => {
  it('preserves low-risk auto path while throttling excessive escalations', async () => {
    // low risk should still allow
    const low = await submitRequest({
      requestId: 'eb-low-1',
      principalId: 'p-budget',
      agentId: 'a-budget',
      actionType: 'other',
      payloadRef: 'safe-read',
      timestamp: Date.now(),
      privilegedPath: true,
    })
    expect(low.decision).toBe('allow')

    // spam escalation path
    let deniedForFlood = 0
    for (let i = 0; i < 10; i++) {
      const out = await submitRequest({
        requestId: `eb-hi-${i}`,
        principalId: 'p-budget',
        agentId: 'a-budget',
        actionType: 'payment',
        payloadRef: 'amount:999',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 999 },
      })
      if (out.reasonCode.startsWith('security_escalation_flood_')) deniedForFlood++
    }

    expect(deniedForFlood).toBeGreaterThan(0)
  })
})
