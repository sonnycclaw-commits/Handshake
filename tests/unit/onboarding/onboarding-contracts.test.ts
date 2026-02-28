import { describe, it, expect } from 'vitest'
import {
  startOnboardingSession,
  selectOnboardingPolicy,
  evaluateGuidedAction,
  getOnboardingPolicyEnvelope,
  getOnboardingProgress,
  getOnboardingAuditExport,
  getTimeToFirstTrustProofMs,
} from '@/domain/services/onboarding-workflow'

describe('Onboarding contract coverage', () => {
  it('T-ONB-006: emits machine-readable policy envelope', () => {
    const s = startOnboardingSession({ principalId: 'p-env', agentId: 'a-env', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-medium', tier: 'medium', now: 1 })

    const env = getOnboardingPolicyEnvelope(s.sessionId)
    expect(env.schemaVersion).toBe('onboarding-policy-envelope/v1')
    expect(env.scope).toEqual(expect.any(Array))
    expect(['low', 'medium', 'high']).toContain(env.tier)
    expect(typeof env.expiryTs).toBe('number')
  })

  it('T-ONB-009: progress contract remains low-cognitive-load and stepwise', () => {
    const s = startOnboardingSession({ principalId: 'p-prog', agentId: 'a-prog', now: 0 })
    const p1 = getOnboardingProgress(s.sessionId)
    expect(p1.requiresProtocolKnowledge).toBe(false)
    expect(p1.currentStep).toMatch(/identity_linked|agent_bound|policy_selected|guided_run_started|trust_proof_shown|revoke_tested|completed|started/)

    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-low', tier: 'low', now: 1 })
    evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'safe_read' },
      context: { hour: 9, privilegedPath: true },
      now: 10,
    })
    const p2 = getOnboardingProgress(s.sessionId)
    expect(p2.requiresProtocolKnowledge).toBe(false)
    expect(p2.currentStep).not.toBe('started')
  })

  it('T-ONB-010: TTFTP metric remains within budget for baseline flow', () => {
    const s = startOnboardingSession({ principalId: 'p-ttftp', agentId: 'a-ttftp', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-low', tier: 'low', now: 1 })
    evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'safe_read' },
      context: { hour: 10, privilegedPath: true },
      now: 100,
    })

    const ttftp = getTimeToFirstTrustProofMs(s.sessionId)
    expect(ttftp).not.toBeNull()
    expect(ttftp!).toBeLessThanOrEqual(5 * 60 * 1000)
  })

  it('T-ONB-013: governance-grade audit export includes consistent lineage/workflow id', () => {
    const s = startOnboardingSession({ principalId: 'p-audit', agentId: 'a-audit', now: 0 })
    selectOnboardingPolicy({ sessionId: s.sessionId, policyId: 'baseline-low', tier: 'low', now: 1 })
    evaluateGuidedAction({
      sessionId: s.sessionId,
      action: { kind: 'payment', amount: 5, category: 'food' },
      context: { hour: 11, privilegedPath: true },
      now: 20,
    })

    const out = getOnboardingAuditExport(s.sessionId)
    expect(out.length).toBeGreaterThan(0)
    const workflowIds = new Set(out.map(e => e.workflowId))
    expect(workflowIds.size).toBe(1)
    expect([...workflowIds][0]).toBe(s.sessionId)
    for (const e of out) {
      expect(e.principalId).toBeTruthy()
      expect(e.agentId).toBeTruthy()
      expect(e.policyId).toBeTruthy()
      expect(e.reasonCode).toBeTruthy()
      expect(typeof e.timestamp).toBe('number')
    }
  })
})
