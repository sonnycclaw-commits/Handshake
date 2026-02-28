import { describe, it, expect } from 'vitest'
import {
  createQuorumRequest,
  getQuorumRequestById,
  submitQuorumDecision,
  upsertQuorumRequest
} from '../../src/domain/services/quorum-hitl'
import { processGovernanceDecision } from '../../src/domain/services/governance-transaction'

describe('Phase 6 Integration: governance atomicity under retry/failure', () => {
  it('remains fail-closed across retry after lineage failure', () => {
    const req = createQuorumRequest({ required: 1, approvers: ['a1'] } as any)

    // first attempt fails at lineage append and must rollback quorum mutation
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

    const afterFailure = getQuorumRequestById(req.id)
    expect(afterFailure?.status).toBe('pending')
    expect(afterFailure?.approvals.length).toBe(0)

    // retry with successful lineage append should approve cleanly
    const retried = processGovernanceDecision(
      { requestId: req.id, approverId: 'a1', decision: 'approve' } as any,
      {
        getRequest: getQuorumRequestById,
        submitDecision: submitQuorumDecision,
        restoreRequest: upsertQuorumRequest,
        appendLineage: () => undefined
      }
    )

    expect(retried.status).toBe('approved')
  })
})
