import { describe, it, expect } from 'vitest'
import { submitRequest, resolveRequestHitl, getRequestAudit } from '@/domain/services/request-workflow-api'
import { getHITLRequest } from '@/domain/services/hitl-workflow'

describe('Request Workflow RED (infra compatibility)', () => {
  it('uses existing HITL workflow for escalations', async () => {
    const out = await submitRequest({
      requestId: 'infra-1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'amount:700',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { amount: 700 }
    })

    expect(out.decision).toBe('escalate')
    expect(out.hitlRequestId).toBeTruthy()
    const req = await getHITLRequest(out.hitlRequestId!)
    expect(req).toBeTruthy()
    expect(req?.status).toBe('pending')
  })

  it('records audit trail for submit + resolution', async () => {
    const out = await submitRequest({
      requestId: 'infra-2',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'amount:700',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { amount: 700 }
    })

    await resolveRequestHitl({
      requestId: out.requestId,
      hitlRequestId: out.hitlRequestId!,
      decision: 'timeout',
      timestamp: Date.now() + 600_000
    })

    const audit = await getRequestAudit(out.requestId)
    expect(audit.length).toBeGreaterThanOrEqual(2)
  })
})
