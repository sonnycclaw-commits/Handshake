import { describe, it, expect } from 'vitest'
import { submitRequest } from '../../../../src/domain/services/request-workflow'

describe('Request Workflow RED (escalation flood control)', () => {
  it('throttles repeated escalations from same agent/principal tuple', async () => {
    const principalId = 'p-flood'
    const agentId = 'a-flood'

    let throttled = false
    for (let i = 0; i < 8; i++) {
      const out = await submitRequest({
        requestId: `flood-${i}`,
        principalId,
        agentId,
        actionType: 'payment',
        payloadRef: 'amount:999',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 999 }
      })

      if (out.decision === 'deny' && out.reasonCode.startsWith('security_escalation_flood_')) {
        throttled = true
      }
    }

    expect(throttled).toBe(true)
  })
})
