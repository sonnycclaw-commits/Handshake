import { describe, it, expect } from 'vitest'
import { buildGovernanceAuditLineage } from '@/domain/services/governance-audit-lineage'

describe('Phase 6 RED: Governance Audit Lineage', () => {
  it('builds immutable lineage chain for governance decisions', () => {
    const lineage = buildGovernanceAuditLineage({ decisionId: 'dec_001' } as any)
    expect(lineage.chain).toBeDefined()
    expect(Array.isArray(lineage.chain)).toBe(true)
  })
})
