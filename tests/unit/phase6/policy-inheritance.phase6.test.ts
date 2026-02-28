import { describe, it, expect } from 'vitest'
import { resolvePolicyInheritance } from '@/domain/services/policy-inheritance'

describe('Phase 6 RED: Policy Inheritance', () => {
  it('resolves child policy with stricter-wins strategy', () => {
    const res = resolvePolicyInheritance({
      parent: { maxTransaction: 50 },
      child: { maxTransaction: 30 }
    } as any)

    expect(res.maxTransaction).toBe(30)
  })

  it('never broadens parent category allowlist', () => {
    const res = resolvePolicyInheritance({
      parent: { allowedCategories: ['food', 'transport'] },
      child: { allowedCategories: ['food', 'electronics'] }
    } as any)

    expect(res.allowedCategories).toEqual(['food'])
  })
})
