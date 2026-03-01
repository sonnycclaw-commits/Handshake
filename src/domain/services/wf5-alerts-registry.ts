export const WF5_ALERT_IDS = [
  'alert_replay_guard_unavailable',
  'alert_denial_spike',
  'alert_tenant_mismatch_spike',
] as const

export type WF5AlertId = (typeof WF5_ALERT_IDS)[number]

export const DEFAULT_WF5_ALERT_THRESHOLDS = {
  maxEscalationRate: 0.35,
  minTimeoutFailClosedRate: 1,
  maxDenialRate: 0.4,
  maxTenantMismatchRate: 0.1,
  replayGuardUnavailableAlertCount: 1,
} as const

export function getWF5AlertThresholds(env?: string) {
  const profile = String(env || '').toLowerCase()

  if (profile === 'prod' || profile === 'production') {
    return {
      ...DEFAULT_WF5_ALERT_THRESHOLDS,
      maxDenialRate: 0.3,
      maxTenantMismatchRate: 0.05,
    }
  }

  if (profile === 'staging') {
    return {
      ...DEFAULT_WF5_ALERT_THRESHOLDS,
      maxDenialRate: 0.6,
      maxTenantMismatchRate: 0.2,
    }
  }

  return { ...DEFAULT_WF5_ALERT_THRESHOLDS }
}
