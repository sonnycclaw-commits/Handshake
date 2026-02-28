import { describe, it, expect } from 'vitest'
import { createQuorumRequest, submitQuorumDecision, getQuorumRequestById, upsertQuorumRequest } from '../../../../src/domain/services/quorum-hitl'
import { processGovernanceDecision } from '../../../../src/domain/services/governance-transaction'

describe('Phase 6 R4: Governance transaction boundary', () => {
  it('commits decision + lineage append together when append succeeds', () => {
    const req = createQuorumRequest({ required: 1, approvers: ['a1'] } as any)

    const result = processGovernanceDecision(
      { requestId: req.id, approverId: 'a1', decision: 'approve' } as any,
      {
        getRequest: getQuorumRequestById,
        submitDecision: submitQuorumDecision,
        restoreRequest: upsertQuorumRequest,
        appendLineage: () => undefined
      }
    )

    expect(result.status).toBe('approved')
    expect(getQuorumRequestById(req.id)?.status).toBe('approved')
  })

  it('rolls back decision when lineage append fails (fail-closed)', () => {
    const req = createQuorumRequest({ required: 1, approvers: ['a1'] } as any)

    expect(() =>
      processGovernanceDecision(
        { requestId: req.id, approverId: 'a1', decision: 'approve' } as any,
        {
          getRequest: getQuorumRequestById,
          submitDecision: submitQuorumDecision,
          restoreRequest: upsertQuorumRequest,
          appendLineage: () => {
            throw new Error('lineage_write_failed')
          }
        }
      )
    ).toThrow(/governance_transaction_failed/)

    expect(getQuorumRequestById(req.id)?.status).toBe('pending')
    expect(getQuorumRequestById(req.id)?.approvals.length).toBe(0)
  })
})
