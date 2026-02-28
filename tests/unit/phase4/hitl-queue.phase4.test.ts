import { describe, it, expect } from 'vitest'
import { listHITLQueue, getHITLDecisionHistory } from '@/domain/services/hitl-queue'

describe('Phase 4 RED: HITL Queue Visibility', () => {
  it('lists pending HITL requests for operator', () => {
    const queue = listHITLQueue({ principalId: 'principal_001' } as any)
    expect(Array.isArray(queue.items)).toBe(true)
  })

  it('returns decision history for request id', () => {
    const history = getHITLDecisionHistory({ requestId: 'hitl_001' } as any)
    expect(Array.isArray(history.events)).toBe(true)
  })
})
