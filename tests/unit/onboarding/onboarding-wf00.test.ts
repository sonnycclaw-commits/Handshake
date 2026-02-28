import { describe, it, expect } from 'vitest'
import {
  startOnboardingSession,
  selectOnboardingPolicy,
  evaluateGuidedAction,
  resolveOnboardingHitl,
  revokeOnboarding,
  getOnboardingAuditEvents,
  getTimeToFirstTrustProofMs,
} from '@/domain/services/onboarding-workflow'

describe('WF-00 RED: onboarding first trust proof contract', () => {
  it('T-ONB-001: completes >=1 policy-governed guided action with trust proof under TTFTP budget', () => {
    const s = startOnboardingSession({ principalId: 'p1', agentId: 'a1', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-low', tier: 'low', now: 1 })

    const result = evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'safe_read' },
      context: { hour: 10, privilegedPath: true },
      now: 50,
    })

    expect(['allow', 'deny', 'escalate']).toContain(result.decision)
    expect(result.reasonCode.length).toBeGreaterThan(0)

    const ttftp = getTimeToFirstTrustProofMs(s.sessionId)
    expect(ttftp).not.toBeNull()
    expect(ttftp!).toBeLessThanOrEqual(5 * 60 * 1000)
  })

  it('T-ONB-002: escalates boundary action and records explicit terminal decision', () => {
    const s = startOnboardingSession({ principalId: 'p2', agentId: 'a2', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-medium', tier: 'medium', now: 1 })

    const escalated = evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'payment', amount: 75, category: 'subscriptions' },
      context: { hour: 10, privilegedPath: true },
      now: 100,
    })

    expect(escalated.decision).toBe('escalate')
    expect(escalated.hitlRequestId).toBeDefined()

    const terminal = resolveOnboardingHitl({
      sessionId: s.sessionId,
      hitlRequestId: escalated.hitlRequestId!,
      decision: 'approve',
      now: 130,
    })

    expect(['allow', 'deny']).toContain(terminal.decision)
    expect(terminal.reasonCode.length).toBeGreaterThan(0)
  })

  it('T-ONB-003: timeout resolves fail-closed deny', () => {
    const s = startOnboardingSession({ principalId: 'p3', agentId: 'a3', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-high', tier: 'high', now: 1 })

    const escalated = evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'payment', amount: 500, category: 'transfer' },
      context: { hour: 11, privilegedPath: true },
      now: 100,
    })

    const terminal = resolveOnboardingHitl({
      sessionId: s.sessionId,
      hitlRequestId: escalated.hitlRequestId || 'missing',
      decision: 'timeout',
      now: 1000,
    })

    expect(terminal.decision).toBe('deny')
    expect(terminal.reasonCode).toMatch(/timeout|expired|fail_closed/i)
  })

  it('T-ONB-004: revoke test denies subsequent privileged action', () => {
    const s = startOnboardingSession({ principalId: 'p4', agentId: 'a4', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-low', tier: 'low', now: 1 })

    const revoked = revokeOnboarding({ sessionId: s.sessionId, principalId: 'p4', now: 120 })
    expect(revoked.revoked).toBe(true)

    const denied = evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'payment', amount: 10, category: 'food' },
      context: { hour: 12, privilegedPath: true, revoked: true },
      now: 130,
    })

    expect(denied.decision).toBe('deny')
    expect(denied.reasonCode).toMatch(/revoked/i)
  })

  it('T-ONB-005: privileged action path is non-bypassable', () => {
    const s = startOnboardingSession({ principalId: 'p5', agentId: 'a5', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-low', tier: 'low', now: 1 })

    const denied = evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'payment', amount: 5, category: 'food' },
      context: { hour: 9, privilegedPath: false },
      now: 50,
    })

    expect(denied.decision).toBe('deny')
    expect(denied.reasonCode).toMatch(/bypass|untrusted_path|handshake_required/i)
  })

  it('T-ONB-008: emits minimum audit events and required dimensions', () => {
    const s = startOnboardingSession({ principalId: 'p6', agentId: 'a6', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-low', tier: 'low', now: 1 })
    evaluateGuidedAction({ sessionId: s.sessionId, action: { kind: 'safe_read' }, context: { hour: 10, privilegedPath: true }, now: 10 })

    const events = getOnboardingAuditEvents(s.sessionId)
    expect(events.length).toBeGreaterThan(0)

    for (const e of events) {
      expect(e.principalId).toBeTruthy()
      expect(e.agentId).toBeTruthy()
      expect(e.workflowId).toBeTruthy()
      expect(e.policyId).toBeTruthy()
      expect(typeof e.tier).toBe('number')
      expect(e.reasonCode).toBeTruthy()
      expect(typeof e.latencyMs).toBe('number')
      expect(typeof e.timestamp).toBe('number')
    }
  })
})
