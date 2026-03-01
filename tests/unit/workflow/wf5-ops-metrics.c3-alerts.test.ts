import { describe, it, expect } from 'vitest'
import { evaluateWF5SLOs } from '@/domain/services/wf5-ops-metrics'

describe('W3-C3 alert thresholds', () => {
  it('alerts on replay guard unavailable incidents', () => {
    const report = evaluateWF5SLOs({
      totalRequests: 50,
      bypassDeniedTotal: 0,
      timeoutFailClosedTotal: 10,
      timeoutEventsTotal: 10,
      escalationTotal: 5,
      terminalMutationDeniedTotal: 0,
      replayGuardUnavailableTotal: 1,
      thresholds: { replayGuardUnavailableAlertCount: 1 },
    })

    expect(report.alerts).toContain('alert_replay_guard_unavailable')
  })

  it('alerts on denial and tenant mismatch spikes', () => {
    const report = evaluateWF5SLOs({
      totalRequests: 100,
      bypassDeniedTotal: 0,
      timeoutFailClosedTotal: 10,
      timeoutEventsTotal: 10,
      escalationTotal: 5,
      terminalMutationDeniedTotal: 0,
      securityDenialTotal: 55,
      tenantMismatchDeniedTotal: 15,
      thresholds: {
        maxDenialRate: 0.4,
        maxTenantMismatchRate: 0.1,
      },
    })

    expect(report.alerts).toContain('alert_denial_spike')
    expect(report.alerts).toContain('alert_tenant_mismatch_spike')
    expect(report.denialRate).toBeGreaterThan(0.4)
    expect(report.tenantMismatchRate).toBeGreaterThan(0.1)
  })
})
