import { describe, it, expect } from 'vitest'
import {
  startOnboardingSession,
  selectOnboardingPolicy,
  evaluateGuidedAction,
  getOnboardingAuditEvents,
} from '@/domain/services/onboarding-workflow'

describe('Onboarding curvy hardening', () => {
  it('denies semantic bypass: non-payment action carrying payment-like fields', () => {
    const s = startOnboardingSession({ principalId: 'p-curvy-1', agentId: 'a-curvy-1', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-low', tier: 'low', now: 1 })

    const out = evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'safe_read', amount: 999, category: 'transfer' },
      context: { hour: 10, privilegedPath: true },
      now: 20,
    })

    expect(out.decision).toBe('deny')
    expect(out.reasonCode).toBe('malformed_action_shape')
  })

  it('keeps deterministic outcome across channel metadata variants', () => {
    const s = startOnboardingSession({ principalId: 'p-curvy-2', agentId: 'a-curvy-2', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-medium', tier: 'medium', now: 1 })

    const a = evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'payment', amount: 20, category: 'subscriptions' },
      context: { hour: 10, privilegedPath: true } as any,
      now: 30,
    })

    const b = evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'payment', amount: 20, category: 'subscriptions' },
      context: { hour: 10, privilegedPath: true, channel: 'chat' } as any,
      now: 31,
    })

    expect(a.decision).toBe(b.decision)
  })

  it('audit reason codes remain explicit (no empty or placeholder values)', () => {
    const s = startOnboardingSession({ principalId: 'p-curvy-3', agentId: 'a-curvy-3', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-low', tier: 'low', now: 1 })
    evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'safe_read' },
      context: { hour: 9, privilegedPath: true },
      now: 10,
    })

    const events = getOnboardingAuditEvents(s.sessionId)
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) {
      expect(e.reasonCode.trim().length).toBeGreaterThan(0)
      expect(e.reasonCode).not.toBe('unknown')
      expect(e.reasonCode).not.toBe('n/a')
    }
  })
})
