import { describe, it, expect } from 'vitest'
import { submitRequest } from '@/domain/services/request-workflow'

describe('Request Workflow RED (sensitive downgrade defense)', () => {
  it('ignores low-risk self-label when payload indicates sensitive operation', async () => {
    const out = await submitRequest({
      requestId: 'sd-1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'data_access',
      payloadRef: 'patient_phi_record',
      timestamp: Date.now(),
      privilegedPath: true,
      context: {
        riskLabel: 'low',
        sensitivity: 'high',
        authorizedSensitiveScope: false
      }
    })

    expect(out.decision).toBe('deny')
    expect(out.reasonCode).toMatch(/policy_sensitive_scope_denied|security_/)
  })
})
