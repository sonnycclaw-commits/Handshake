import { describe, it, expect } from 'vitest'
import { createQuorumRequest, submitQuorumDecision } from '@/domain/services/quorum-hitl'

describe('Phase 6 RED: Quorum HITL', () => {
  it('requires M-of-N approvals before terminal approve', () => {
    const req = createQuorumRequest({ required: 2, approvers: ['a1', 'a2', 'a3'] } as any)
    submitQuorumDecision({ requestId: req.id, approverId: 'a1', decision: 'approve' } as any)
    const afterOne = submitQuorumDecision({ requestId: req.id, approverId: 'a2', decision: 'approve' } as any)
    expect(afterOne.status).toBe('approved')
  })

  it('rejects unauthorized approver decisions', () => {
    const req = createQuorumRequest({ required: 2, approvers: ['a1', 'a2'] } as any)
    expect(() => submitQuorumDecision({ requestId: req.id, approverId: 'a3', decision: 'approve' } as any)).toThrow(
      /forbidden/
    )
  })

  it('is idempotent for duplicate approver decisions', () => {
    const req = createQuorumRequest({ required: 2, approvers: ['a1', 'a2'] } as any)
    const first = submitQuorumDecision({ requestId: req.id, approverId: 'a1', decision: 'approve' } as any)
    const second = submitQuorumDecision({ requestId: req.id, approverId: 'a1', decision: 'approve' } as any)

    expect(first.approvals.length).toBe(1)
    expect(second.approvals.length).toBe(1)
    expect(second.status).toBe('pending')
  })
})
