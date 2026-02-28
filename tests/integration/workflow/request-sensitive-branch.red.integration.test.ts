import { describe, it, expect } from 'vitest'
import { submitRequest } from '@/domain/services/request-workflow'

describe('Request Workflow RED (sensitive branch)', () => {
  it('denies unauthorized sensitive scope', async () => {
    const out = await submitRequest({
      requestId: 'sens-1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'data_access',
      payloadRef: 'customer-phi',
      timestamp: Date.now(),
      privilegedPath: true,
      context: {
        authorizedSensitiveScope: false,
        sensitivity: 'high'
      }
    })

    expect(out.decision).toBe('deny')
    expect(out.reasonCode).toMatch(/policy_|security_/)
  })

  it('escalates ambiguous sensitive request', async () => {
    const out = await submitRequest({
      requestId: 'sens-2',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'data_access',
      payloadRef: 'customer-record',
      timestamp: Date.now(),
      privilegedPath: true,
      context: {
        sensitivity: 'ambiguous'
      }
    })

    expect(out.decision).toBe('escalate')
    expect(out.hitlRequestId).toBeTruthy()
  })
})
