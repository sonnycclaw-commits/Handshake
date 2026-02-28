import { describe, it, expect } from 'vitest'
import { evaluatePolicy } from '../../src/domain/services/policy-evaluator'

describe('Policy Enforcement Decision Matrix', () => {
  it('allows in-policy request at tier1', () => {
    const res = evaluatePolicy(
      { maxTransaction: 30, dailySpendLimit: 100, allowedCategories: ['food'], allowedHours: '08:00-22:00' },
      { amount: 20, category: 'food', hour: 12 }
    )
    expect(res.decision).toBe('allow')
    expect(res.tier).toBe(1)
    expect(res.requiresHITL).toBe(false)
  })

  it('denies malformed policy inputs fail-closed', () => {
    const res = evaluatePolicy({ maxTransaction: Number.NaN }, { amount: 20, category: 'food', hour: 12 })
    expect(res.decision).toBe('deny')
    expect(res.reasons).toContain('invalid_policy')
  })

  it('denies missing amount as invalid request', () => {
    const res = evaluatePolicy({ maxTransaction: 30 }, { category: 'food', hour: 12 })
    expect(res.decision).toBe('deny')
    expect(res.reasons).toContain('invalid_request')
  })

  it('allows zero-amount read-class request at low tier', () => {
    const res = evaluatePolicy({ maxTransaction: 30 }, { amount: 0, category: 'food', hour: 12 })
    expect(res.decision).toBe('allow')
    expect(res.tier).toBeLessThanOrEqual(1)
  })

  it('denies unknown category when allowlist is enforced', () => {
    const res = evaluatePolicy(
      { maxTransaction: 30, allowedCategories: ['food', 'transport'] },
      { amount: 10, category: 'unknown', hour: 12 }
    )
    expect(res.decision).toBe('deny')
    expect(res.reasons).toContain('category_not_allowed')
  })

  it('escalates very high amount to tier4 + HITL', () => {
    const res = evaluatePolicy(
      { maxTransaction: 30, dailySpendLimit: 500, allowedCategories: ['food'] },
      { amount: 120, category: 'food', hour: 12 }
    )
    expect(res.decision).toBe('allow')
    expect(res.tier).toBe(4)
    expect(res.requiresHITL).toBe(true)
  })
})
