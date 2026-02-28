import { describe, it, expect } from 'vitest'
import {
  createHITLRequest,
  approveHITL,
  rejectHITL,
  timeoutHITL
} from '@/domain/services/hitl-workflow'

describe('HITL Workflow (phase 3)', () => {
  it('creates pending request with expiry', async () => {
    const req = await createHITLRequest({
      agentId: 'agent_1',
      principalId: 'principal_1',
      tier: 3,
      action: 'payment'
    })

    expect(req.status).toBe('pending')
    expect(req.expiresAt).toBeGreaterThan(req.createdAt)
    expect(req.id).toMatch(/^hitl_/) 
  })

  it('terminal state is immutable (approve then reject keeps approved)', async () => {
    const req = await createHITLRequest({ agentId: 'a', principalId: 'p', tier: 3, action: 'payment' })
    const approved = await approveHITL(req.id, { approverId: 'p' })
    expect(approved.status).toBe('approved')

    const rejectedAfterApproval = await rejectHITL(req.id, { reason: 'late reject' })
    expect(rejectedAfterApproval.status).toBe('approved')
  })

  it('timeout rejects pending by default', async () => {
    const req = await createHITLRequest({ agentId: 'a', principalId: 'p', tier: 3, action: 'payment' })
    const expired = await timeoutHITL(req.id)
    expect(expired.status).toBe('rejected')
    expect(expired.reason).toBe('timeout_reject')
  })
})
