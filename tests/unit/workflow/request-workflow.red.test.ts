import { describe, it, expect } from 'vitest'
import { submitRequest, resolveRequestHitl, getRequestAudit } from '../../../../src/domain/services/request-workflow'

describe('Request Workflow RED (unit)', () => {
  it('RW-001: denies invalid shape or trust context fail-closed', async () => {
    const out = await submitRequest({
      requestId: 'r1',
      principalId: '',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'p',
      timestamp: Date.now(),
      privilegedPath: true,
    } as any)
    expect(out.decision).toBe('deny')
    expect(out.reasonCode).toMatch(/missing|invalid|fail_closed/i)
  })

  it('RW-002: boundary request escalates deterministically', async () => {
    const out = await submitRequest({
      requestId: 'r2',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'amount:500',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { amount: 500 },
    })
    expect(out.decision).toBe('escalate')
    expect(out.hitlRequestId).toBeTruthy()
  })

  it('RW-003: timeout terminal deny and late approve remains deny', async () => {
    const escalated = await submitRequest({
      requestId: 'r3',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'amount:300',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { amount: 300 },
    })

    const expired = await resolveRequestHitl({
      requestId: escalated.requestId,
      hitlRequestId: escalated.hitlRequestId || 'missing',
      decision: 'timeout',
      timestamp: Date.now() + 1000,
    })
    expect(expired.decision).toBe('deny')

    const lateApprove = await resolveRequestHitl({
      requestId: escalated.requestId,
      hitlRequestId: escalated.hitlRequestId || 'missing',
      decision: 'approve',
      timestamp: Date.now() + 1001,
    })
    expect(lateApprove.decision).toBe('deny')
    expect(lateApprove.reasonCode).toMatch(/terminal|expired|fail_closed/i)
  })

  it('RW-006: emits audit events with non-empty reason codes', async () => {
    await submitRequest({
      requestId: 'r4',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'other',
      payloadRef: 'read',
      timestamp: Date.now(),
      privilegedPath: true,
    })

    const audit = await getRequestAudit('r4')
    expect(audit.length).toBeGreaterThan(0)
    for (const e of audit as any[]) {
      expect(String(e.reasonCode || '').trim().length).toBeGreaterThan(0)
    }
  })
})
