import { describe, it, expect } from 'vitest'
import { createQuorumRequest } from '@/domain/services/quorum-hitl'

describe('Phase 6 A3: quorum runtime determinism', () => {
  it('uses injected clock/id providers when supplied', () => {
    const req = createQuorumRequest(
      { required: 2, approvers: ['a1', 'a2'] } as any,
      {
        now: () => 1700000000000,
        nextId: () => 'q_fixed'
      } as any
    )

    expect(req.id).toBe('q_fixed')
    expect(req.createdAt).toBe(1700000000000)
  })
})
