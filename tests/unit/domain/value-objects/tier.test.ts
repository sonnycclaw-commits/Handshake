import { describe, it, expect } from 'vitest'
import { Tier } from '@/domain/value-objects/tier'

describe('Tier', () => {
  it('exposes Tier.TIER_0 with level 0 and name "Auto-approved"', () => {
    expect(Tier.TIER_0.level).toBe(0)
    expect(Tier.TIER_0.name).toBe('Auto-approved')
  })

  it('exposes Tier.TIER_1 with level 1 and name "Silent"', () => {
    expect(Tier.TIER_1.level).toBe(1)
    expect(Tier.TIER_1.name).toBe('Silent')
  })

  it('exposes Tier.TIER_2 with level 2 and name "One-tap"', () => {
    expect(Tier.TIER_2.level).toBe(2)
    expect(Tier.TIER_2.name).toBe('One-tap')
  })

  it('exposes Tier.TIER_3 with level 3 and name "Confirm"', () => {
    expect(Tier.TIER_3.level).toBe(3)
    expect(Tier.TIER_3.name).toBe('Confirm')
  })

  it('exposes Tier.TIER_4 with level 4 and name "Quorum"', () => {
    expect(Tier.TIER_4.level).toBe(4)
    expect(Tier.TIER_4.name).toBe('Quorum')
  })

  it('requiresHITL returns false for Tier 0', () => {
    expect(Tier.TIER_0.requiresHITL()).toBe(false)
  })

  it('requiresHITL returns false for Tier 1', () => {
    expect(Tier.TIER_1.requiresHITL()).toBe(false)
  })

  it('requiresHITL returns true for Tier 2', () => {
    expect(Tier.TIER_2.requiresHITL()).toBe(true)
  })

  it('requiresHITL returns true for Tier 3', () => {
    expect(Tier.TIER_3.requiresHITL()).toBe(true)
  })

  it('requiresHITL returns true for Tier 4', () => {
    expect(Tier.TIER_4.requiresHITL()).toBe(true)
  })
})
