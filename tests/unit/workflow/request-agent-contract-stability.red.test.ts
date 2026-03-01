import { describe, it, expect } from 'vitest'
import { submitRequest } from '@/domain/services/request-workflow-api'
import { getRetryPolicyForReason } from '@/domain/services/request-retry-policy'

describe('Request Workflow RED (agent contract stability)', () => {
  it('maps deny reason classes to deterministic retry policy', async () => {
    const denied = await submitRequest({
      requestId: 'acs-1',
      principalId: '',
      agentId: 'a1',
      actionType: 'other',
      payloadRef: 'x',
      timestamp: Date.now(),
      privilegedPath: true,
    } as any)

    expect(denied.decision).toBe('deny')
    expect(denied.responseClass).toBe('blocked')
    const policy = getRetryPolicyForReason(denied.reasonCode)
    expect(policy.decision).toMatch(/retry_after_remediation|do_not_retry/)
  })

  it('fails closed for unknown reason classes', () => {
    const p = getRetryPolicyForReason('brand_new_unknown_code')
    expect(p.decision).toBe('do_not_retry')
    expect(p.maxRetries).toBe(0)
  })
})
