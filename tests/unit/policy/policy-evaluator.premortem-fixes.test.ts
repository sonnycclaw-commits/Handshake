import { describe, it, expect } from 'vitest'
import { evaluatePolicy } from '../../../../src/domain/services/policy-evaluator'

describe('Policy Evaluator Premortem Fixes', () => {
  it('denies when daily spend limit exceeded', () => {
    const res = evaluatePolicy({ dailySpendLimit: 50, maxTransaction: 100 }, { amount: 80, category: 'food', hour: 12 })
    expect(res.decision).toBe('deny')
    expect(res.reasons).toContain('daily_limit_exceeded')
  })

  it('denies outside allowed hours (fail closed)', () => {
    const res = evaluatePolicy({ allowedHours: '08:00-22:00' }, { amount: 10, category: 'food', hour: 2 })
    expect(res.decision).toBe('deny')
    expect(res.reasons).toContain('outside_allowed_hours')
  })

  it('denies invalid negative amount requests', () => {
    const res = evaluatePolicy({ maxTransaction: 20 }, { amount: -1, category: 'food', hour: 12 })
    expect(res.decision).toBe('deny')
    expect(res.reasons).toContain('invalid_request')
  })
})
