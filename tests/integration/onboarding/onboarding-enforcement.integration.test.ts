import { describe, it, expect } from 'vitest'
import {
  startOnboardingSession,
  selectOnboardingPolicy,
  evaluateGuidedAction,
  getOnboardingAuditEvents,
} from '@/domain/services/onboarding-workflow'

describe('Onboarding RED integration: enforcement + deterministic outcomes', () => {
  it('T-ONB-011: logs security event on privileged bypass attempt', () => {
    const s = startOnboardingSession({ principalId: 'p-int-1', agentId: 'a-int-1', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-low', tier: 'low', now: 1 })

    const denied = evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'payment', amount: 10, category: 'food' },
      context: { hour: 10, privilegedPath: false },
      now: 20,
    })

    expect(denied.decision).toBe('deny')

    const events = getOnboardingAuditEvents(s.sessionId)
    expect(events.some(e => /bypass|handshake_required/i.test(e.reasonCode))).toBe(true)
  })

  it('T-ONB-014: outcome class remains deterministic for same policy+input', () => {
    const s = startOnboardingSession({ principalId: 'p-int-2', agentId: 'a-int-2', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-medium', tier: 'medium', now: 1 })

    const a = evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'payment', amount: 20, category: 'subscriptions' },
      context: { hour: 10, privilegedPath: true },
      now: 30,
    })

    const b = evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'payment', amount: 20, category: 'subscriptions' },
      context: { hour: 10, privilegedPath: true },
      now: 31,
    })

    expect(a.decision).toBe(b.decision)
    expect(typeof a.reasonCode).toBe('string')
    expect(typeof b.reasonCode).toBe('string')
  })
})
