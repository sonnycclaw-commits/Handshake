import { describe, it, expect } from 'vitest'
import { createQuorumRequest } from '../../../../src/domain/services/quorum-hitl'
import { submitGovernanceDecision } from '../../../../src/domain/services/governance-transaction'
import { getGovernanceLineageByDecisionId } from '../../../../src/domain/services/governance-audit-lineage'

describe('Phase 6 A1: governance canonical write path', () => {
  it('writes decision and lineage through submitGovernanceDecision', () => {
    const req = createQuorumRequest({ required: 1, approvers: ['a1'] } as any)

    const updated = submitGovernanceDecision({
      requestId: req.id,
      approverId: 'a1',
      decision: 'approve'
    } as any)

    expect(updated.status).toBe('approved')

    const lineage = getGovernanceLineageByDecisionId(req.id)
    expect(lineage.length).toBeGreaterThanOrEqual(1)
    expect(lineage[0].decisionId).toBe(req.id)
  })
})
