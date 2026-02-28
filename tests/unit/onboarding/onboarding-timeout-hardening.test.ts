import { describe, it, expect } from 'vitest'
import {
  startOnboardingSession,
  selectOnboardingPolicy,
  evaluateGuidedAction,
  resolveOnboardingHitl,
} from '../../../../src/domain/services/onboarding-workflow'

describe('Onboarding timeout/fail-closed hardening', () => {
  it('OBE-4.1: once HITL expires, later approval cannot implicitly allow', () => {
    const s = startOnboardingSession({ principalId: 'p-timeout', agentId: 'a-timeout', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-high', tier: 'high', now: 1 })

    const escalated = evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'payment', amount: 300, category: 'transfer' },
      context: { hour: 11, privilegedPath: true },
      now: 10,
    })

    expect(escalated.decision).toBe('escalate')
    expect(escalated.hitlRequestId).toBeDefined()

    const expired = resolveOnboardingHitl({
      sessionId: s.sessionId,
      hitlRequestId: escalated.hitlRequestId!,
      decision: 'timeout',
      now: 1000,
    })

    expect(expired.decision).toBe('deny')
    expect(expired.reasonCode).toMatch(/timeout|expired|fail_closed/i)

    const lateApprove = resolveOnboardingHitl({
      sessionId: s.sessionId,
      hitlRequestId: escalated.hitlRequestId!,
      decision: 'approve',
      now: 1001,
    })

    expect(lateApprove.decision).toBe('deny')
    expect(lateApprove.reasonCode).toMatch(/terminal|expired|fail_closed/i)
  })

  it('OBE-4.1: once HITL rejected, later approval remains denied', () => {
    const s = startOnboardingSession({ principalId: 'p-rej', agentId: 'a-rej', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-high', tier: 'high', now: 1 })

    const escalated = evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'payment', amount: 250, category: 'transfer' },
      context: { hour: 11, privilegedPath: true },
      now: 10,
    })

    const rejected = resolveOnboardingHitl({
      sessionId: s.sessionId,
      hitlRequestId: escalated.hitlRequestId!,
      decision: 'reject',
      now: 12,
    })
    expect(rejected.decision).toBe('deny')

    const lateApprove = resolveOnboardingHitl({
      sessionId: s.sessionId,
      hitlRequestId: escalated.hitlRequestId!,
      decision: 'approve',
      now: 13,
    })
    expect(lateApprove.decision).toBe('deny')
    expect(lateApprove.reasonCode).toMatch(/terminal|rejected|fail_closed/i)
  })
})
