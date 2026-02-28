import { describe, it, expect } from 'vitest'
import { createPolicyDraft, simulatePolicy, publishPolicy } from '../../../../src/domain/services/policy-management'

describe('Phase 4 RED: Policy Management', () => {
  it('creates policy draft with version metadata', () => {
    const draft = createPolicyDraft({ principalId: 'principal_001', policy: { maxTransaction: 30 } } as any)
    expect(draft.version).toBeDefined()
    expect(draft.status).toBe('draft')
  })

  it('simulates policy decision deterministically', () => {
    const result = simulatePolicy({ policy: { maxTransaction: 30 }, request: { amount: 20 } } as any)
    expect(result.decision).toBeDefined()
  })

  it('publishes draft policy as active version', () => {
    const pub = publishPolicy({ draftId: 'draft_001' } as any)
    expect(pub.status).toBe('active')
  })
})
