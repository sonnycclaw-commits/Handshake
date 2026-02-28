import { describe, it, expect } from 'vitest'
import { createHITLRequest, approveHITL, timeoutHITL } from '@/domain/services/hitl-workflow'

describe('HITL Workflow Premortem Fixes', () => {
  it('does not timeout before expiry when now is provided', async () => {
    const req = await createHITLRequest({ agentId: 'a', principalId: 'p', tier: 3, action: 'payment' })
    const before = await timeoutHITL(req.id, req.createdAt + 1000)
    expect(before.status).toBe('pending')
  })

  it('rejects unauthorized approver', async () => {
    const req = await createHITLRequest({ agentId: 'a', principalId: 'principal_1', tier: 3, action: 'payment' })
    await expect(() => approveHITL(req.id, { approverId: 'principal_2' })).rejects.toThrow('HITL_UNAUTHORIZED_APPROVER')
  })
})
