import { describe, it, expect } from 'vitest'
import { issueDelegationEnvelope } from '@/domain/services/delegated-authority'

describe('Phase 6 A2: delegated authority runtime determinism', () => {
  it('uses injected clock/id providers when supplied', () => {
    const env = issueDelegationEnvelope(
      { from: 'agent_a', to: 'agent_b', scopes: ['read'] } as any,
      {
        now: () => 1700000000000,
        nextId: () => 'del_fixed'
      } as any
    )

    expect(env.id).toBe('del_fixed')
    expect(env.issuedAt).toBe(1700000000000)
  })
})
