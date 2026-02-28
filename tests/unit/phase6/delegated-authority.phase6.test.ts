import { describe, it, expect } from 'vitest'
import { issueDelegationEnvelope, validateDelegatedAction } from '@/domain/services/delegated-authority'

describe('Phase 6 RED: Delegated Authority', () => {
  it('issues scoped delegation envelope', () => {
    const env = issueDelegationEnvelope({ from: 'agent_a', to: 'agent_b', scopes: ['payment:low'] } as any)
    expect(env.scopes).toContain('payment:low')
  })

  it('rejects delegated action outside scope', () => {
    const result = validateDelegatedAction({ scopes: ['read'], action: 'payment' } as any)
    expect(result.allowed).toBe(false)
  })

  it('allows wildcard namespace scope match', () => {
    const result = validateDelegatedAction({ scopes: ['payment:*'], action: 'payment:refund' } as any)
    expect(result.allowed).toBe(true)
  })

  it('rejects malformed scope list fail-closed', () => {
    const result = validateDelegatedAction({ scopes: ['   '], action: 'payment:refund' } as any)
    expect(result.allowed).toBe(false)
  })
})
