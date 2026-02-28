import { describe, it, expect } from 'vitest'
import {
  incrWF5Metric,
  getWF5MetricsSnapshot,
  evaluateWF5SLOs,
} from '../../../../src/domain/services/wf5-ops-metrics'

describe('WF5 Ops Metrics + SLOs (C7)', () => {
  it('records counters for wf5 metrics', async () => {
    await incrWF5Metric('wf5_requests_total')
    await incrWF5Metric('wf5_decision_allow_total')
    await incrWF5Metric('wf5_decision_deny_total', 2)

    const snap = await getWF5MetricsSnapshot()
    expect(snap['wf5_requests_total']).toBeGreaterThanOrEqual(1)
    expect(snap['wf5_decision_allow_total']).toBeGreaterThanOrEqual(1)
    expect(snap['wf5_decision_deny_total']).toBeGreaterThanOrEqual(2)
  })

  it('emits alerts when SLO thresholds are breached', () => {
    const report = evaluateWF5SLOs({
      totalRequests: 100,
      bypassDeniedTotal: 10,
      timeoutFailClosedTotal: 8,
      timeoutEventsTotal: 10,
      escalationTotal: 60,
      terminalMutationDeniedTotal: 1,
      thresholds: { maxEscalationRate: 0.3, minTimeoutFailClosedRate: 1 }
    })

    expect(report.alerts).toContain('slo_timeout_fail_closed_breach')
    expect(report.alerts).toContain('slo_escalation_burden_high')
    expect(report.alerts).toContain('slo_terminal_mutation_attempts_detected')
  })
})
