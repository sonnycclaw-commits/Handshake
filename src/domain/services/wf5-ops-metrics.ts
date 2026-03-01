import { WF5_ALERT_IDS, getWF5AlertThresholds } from './wf5-alerts-registry'
export type WF5MetricName =
  | 'wf5_requests_total'
  | 'wf5_decision_allow_total'
  | 'wf5_decision_deny_total'
  | 'wf5_decision_escalate_total'
  | 'wf5_timeout_fail_closed_total'
  | 'wf5_bypass_denied_total'
  | 'wf5_terminal_mutation_denied_total'
  | 'wf5_escalation_throttled_total'
  | 'wf5_artifact_gate_denied_total'
  | 'wf5_artifact_gate_allowed_total'
  | 'wf5_security_denial_total'
  | 'wf5_replay_detected_total'
  | 'wf5_replay_guard_unavailable_total'

export type WF5MetricSample = {
  name: WF5MetricName
  value: number
  labels?: Record<string, string>
}

export interface WF5OpsMetricsStore {
  incr(name: WF5MetricName, value?: number, labels?: Record<string, string>): Promise<void>
  snapshot(): Promise<Record<string, number>>
}

class InMemoryWF5OpsMetricsStore implements WF5OpsMetricsStore {
  private counters = new Map<string, number>()

  async incr(name: WF5MetricName, value = 1, labels?: Record<string, string>): Promise<void> {
    const key = withLabels(name, labels)
    this.counters.set(key, (this.counters.get(key) ?? 0) + value)
  }

  async snapshot(): Promise<Record<string, number>> {
    const out: Record<string, number> = {}
    for (const [k, v] of this.counters.entries()) out[k] = v
    return out
  }
}

let activeStore: WF5OpsMetricsStore = new InMemoryWF5OpsMetricsStore()

export function setWF5OpsMetricsStore(store: WF5OpsMetricsStore): void {
  activeStore = store
}

export async function incrWF5Metric(name: WF5MetricName, value = 1, labels?: Record<string, string>): Promise<void> {
  await activeStore.incr(name, value, labels)
}

export async function getWF5MetricsSnapshot(): Promise<Record<string, number>> {
  return activeStore.snapshot()
}

function withLabels(name: string, labels?: Record<string, string>): string {
  if (!labels || Object.keys(labels).length === 0) return name
  const stable = Object.keys(labels).sort().map((k) => `${k}=${labels[k]}`).join(',')
  return `${name}{${stable}}`
}

export type WF5SLOReport = {
  bypassSuccessRate: number
  timeoutFailClosedRate: number
  escalationRate: number
  terminalMutationViolations: number
  denialRate: number
  tenantMismatchRate: number
  replayGuardUnavailableCount: number
  alerts: string[]
}

export function evaluateWF5SLOs(input: {
  totalRequests: number
  bypassDeniedTotal: number
  timeoutFailClosedTotal: number
  timeoutEventsTotal: number
  escalationTotal: number
  terminalMutationDeniedTotal: number
  securityDenialTotal?: number
  tenantMismatchDeniedTotal?: number
  replayGuardUnavailableTotal?: number
  thresholds?: {
    maxEscalationRate?: number
    minTimeoutFailClosedRate?: number
    maxDenialRate?: number
    maxTenantMismatchRate?: number
    replayGuardUnavailableAlertCount?: number
  }
  environment?: string
}): WF5SLOReport {
  const total = Math.max(1, input.totalRequests)
  const timeoutEvents = Math.max(1, input.timeoutEventsTotal)
  const envDefaults = getWF5AlertThresholds(input.environment)
  const thresholds = {
    maxEscalationRate: input.thresholds?.maxEscalationRate ?? envDefaults.maxEscalationRate,
    minTimeoutFailClosedRate: input.thresholds?.minTimeoutFailClosedRate ?? envDefaults.minTimeoutFailClosedRate,
    maxDenialRate: input.thresholds?.maxDenialRate ?? envDefaults.maxDenialRate,
    maxTenantMismatchRate: input.thresholds?.maxTenantMismatchRate ?? envDefaults.maxTenantMismatchRate,
    replayGuardUnavailableAlertCount: input.thresholds?.replayGuardUnavailableAlertCount ?? envDefaults.replayGuardUnavailableAlertCount,
  }

  const securityDenials = Math.max(0, input.securityDenialTotal ?? 0)
  const tenantMismatch = Math.max(0, input.tenantMismatchDeniedTotal ?? 0)
  const replayGuardUnavailable = Math.max(0, input.replayGuardUnavailableTotal ?? 0)

  const report: WF5SLOReport = {
    bypassSuccessRate: 0,
    timeoutFailClosedRate: input.timeoutFailClosedTotal / timeoutEvents,
    escalationRate: input.escalationTotal / total,
    terminalMutationViolations: input.terminalMutationDeniedTotal,
    denialRate: securityDenials / total,
    tenantMismatchRate: tenantMismatch / total,
    replayGuardUnavailableCount: replayGuardUnavailable,
    alerts: []
  }

  if (report.timeoutFailClosedRate < thresholds.minTimeoutFailClosedRate) {
    report.alerts.push('slo_timeout_fail_closed_breach')
  }

  if (report.escalationRate > thresholds.maxEscalationRate) {
    report.alerts.push('slo_escalation_burden_high')
  }

  if (input.terminalMutationDeniedTotal > 0) {
    report.alerts.push('slo_terminal_mutation_attempts_detected')
  }

  if (report.denialRate > thresholds.maxDenialRate) {
    report.alerts.push(WF5_ALERT_IDS[1])
  }

  if (report.tenantMismatchRate > thresholds.maxTenantMismatchRate) {
    report.alerts.push(WF5_ALERT_IDS[2])
  }

  if (report.replayGuardUnavailableCount >= thresholds.replayGuardUnavailableAlertCount) {
    report.alerts.push(WF5_ALERT_IDS[0])
  }

  // bypass success should always remain zero; denied counts are observability evidence.
  // if this ever becomes non-zero in real runtime instrumentation, it must be emitted separately.
  return report
}
