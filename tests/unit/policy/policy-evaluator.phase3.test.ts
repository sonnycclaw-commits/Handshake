import { describe, it, expect } from 'vitest'
import { evaluatePolicy } from '../../../../src/domain/services/policy-evaluator'

describe('Phase 3 RED: Policy Evaluator', () => {
  it('returns deterministic decision for same input', () => {
    const policy = {
      dailySpendLimit: 50,
      maxTransaction: 30,
      allowedHours: '08:00-22:00',
      allowedCategories: ['food', 'transport']
    }

    const request = { amount: 20, category: 'food', hour: 12 }

    const a = evaluatePolicy(policy, request)
    const b = evaluatePolicy(policy, request)

    expect(a).toEqual(b)
  })

  it('escalates tier when request exceeds policy threshold', () => {
    const policy = { maxTransaction: 30 }
    const request = { amount: 120, category: 'food', hour: 12 }

    const result = evaluatePolicy(policy, request)
    expect(result.tier).toBeGreaterThanOrEqual(3)
    expect(result.requiresHITL).toBe(true)
  })

  it('fails closed on malformed policy input', () => {
    const malformed: any = { maxTransaction: 'not-a-number' }
    const request = { amount: 20, category: 'food', hour: 12 }

    const result = evaluatePolicy(malformed, request)
    expect(result.decision).toBe('deny')
  })
})
