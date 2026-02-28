import { describe, it, expect } from 'vitest'
import { evaluatePolicy } from '@/domain/services/policy-evaluator'
import { createHITLRequest, approveHITL, timeoutHITL } from '@/domain/services/hitl-workflow'

describe('Policy + HITL Integration (phase 3)', () => {
  it('escalates boundary request and allows after approval', async () => {
    const decision = evaluatePolicy(
      { maxTransaction: 100, dailySpendLimit: 1000, allowedHours: '08:00-22:00', allowedCategories: ['food'] },
      { amount: 150, category: 'food', hour: 10 }
    )
    expect(decision.decision).toBe('allow')
    expect(decision.requiresHITL).toBe(true)

    const req = await createHITLRequest({
      agentId: 'agent_1',
      principalId: 'principal_001',
      tier: decision.tier,
      action: 'payment'
    })

    const approved = await approveHITL(req.id, { approverId: 'principal_001' })
    expect(approved.status).toBe('approved')
  })

  it('escalates boundary request and rejects on timeout', async () => {
    const decision = evaluatePolicy(
      { maxTransaction: 100, dailySpendLimit: 1000, allowedHours: '08:00-22:00', allowedCategories: ['food'] },
      { amount: 180, category: 'food', hour: 10 }
    )
    expect(decision.requiresHITL).toBe(true)

    const req = await createHITLRequest({
      agentId: 'agent_2',
      principalId: 'principal_001',
      tier: decision.tier,
      action: 'payment'
    })

    const timedOut = await timeoutHITL(req.id)
    expect(timedOut.status).toBe('rejected')
  })
})
