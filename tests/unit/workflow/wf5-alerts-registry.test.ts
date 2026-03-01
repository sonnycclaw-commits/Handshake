import { describe, it, expect } from 'vitest'
import { WF5_ALERT_IDS, getWF5AlertThresholds } from '@/domain/services/wf5-alerts-registry'

describe('WF5 alerts registry', () => {
  it('defines canonical W3 alert ids', () => {
    expect(WF5_ALERT_IDS).toEqual([
      'alert_replay_guard_unavailable',
      'alert_denial_spike',
      'alert_tenant_mismatch_spike',
    ])
  })

  it('provides environment-aware threshold profiles', () => {
    const prod = getWF5AlertThresholds('production')
    const staging = getWF5AlertThresholds('staging')

    expect(prod.maxDenialRate).toBeLessThan(staging.maxDenialRate)
    expect(prod.maxTenantMismatchRate).toBeLessThan(staging.maxTenantMismatchRate)
  })
})
