import { describe, it, expect } from 'vitest'
import { buildOperatorReadModel } from '../../../../src/domain/services/operator-read-model'

describe('Phase 4 RED: Operator Read Model', () => {
  it('builds consolidated operator timeline with audit+hitl status', () => {
    const model = buildOperatorReadModel({ principalId: 'principal_001' } as any)
    expect(model.timeline).toBeDefined()
    expect(Array.isArray(model.timeline)).toBe(true)
  })

  it('filters by actor scope correctly', () => {
    const model = buildOperatorReadModel({ principalId: 'principal_001', actorId: 'agent_001' } as any)
    expect(model.filters.actorId).toBe('agent_001')
  })
})
