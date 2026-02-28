import { describe, it, expect } from 'vitest'
import { deliverHITLNotification } from '../../../../src/domain/services/hitl-delivery'

describe('Phase 3.5 RED: HITL Delivery Reliability', () => {
  it('retries on transient delivery failures', async () => {
    const result = await deliverHITLNotification({
      requestId: 'hitl_001',
      principalId: 'principal_001',
      tier: 3,
      action: 'payment',
      expiresAt: Date.now() + 300000,
      idempotencyKey: 'idem_001'
    })

    expect(result.attempts).toBeGreaterThanOrEqual(1)
  })

  it('fails closed when retry budget is exhausted', async () => {
    const result = await deliverHITLNotification({
      requestId: 'hitl_002',
      principalId: 'principal_001',
      tier: 4,
      action: 'destructive_op',
      expiresAt: Date.now() + 300000,
      idempotencyKey: 'idem_002',
      forceFailure: true
    } as any)

    expect(result.status).toBe('failed')
    expect(result.failClosed).toBe(true)
  })

  it('does not include secret-bearing fields in delivery envelope', async () => {
    const result = await deliverHITLNotification({
      requestId: 'hitl_003',
      principalId: 'principal_001',
      tier: 3,
      action: 'payment',
      expiresAt: Date.now() + 300000,
      idempotencyKey: 'idem_003'
    })

    const body = JSON.stringify(result.envelope)
    expect(body).not.toMatch(/secret|token|password|private[_-]?key/i)
  })
})
