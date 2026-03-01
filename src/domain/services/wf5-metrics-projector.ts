export const METRICS_SCHEMA_VERSION = 'v1'
export const METRICS_PROJECTOR_VERSION = 'v1'

export type Decision = 'allow' | 'deny' | 'escalate'
export type ReasonFamily = 'trust_context' | 'policy' | 'security' | 'hitl' | 'adapter' | 'unknown'
export type RiskTier = 'low' | 'medium' | 'high' | 'critical' | 'unknown'

export type MetricsEvent = {
  eventId: string
  requestId: string
  timestampMs: number
  decision: Decision
  reasonCode: string
  reasonFamily: ReasonFamily
  riskTier: RiskTier
  isTerminal: boolean
  hasValidLineage: boolean
  incidentDetectedTsMs?: number
  terminalDecisionTsMs?: number
  humanMinutes?: number
  computeCostUnits?: number
  escalationOverheadUnits?: number
}

export type MetricsSummary = {
  uair: number
  airtP50Ms: number
  airtP95Ms: number
  gar: number
  tca: number
  totalEvents: number
  denialEvents: number
  replayDetectedEvents: number
  replayGuardUnavailableEvents: number
}

export function computeMetricsSummary(events: MetricsEvent[]): MetricsSummary {
  const risky = events.filter((e) => e.riskTier === 'high' || e.riskTier === 'critical')
  const intercepted = risky.filter((e) => e.decision === 'deny' || e.decision === 'escalate')
  const uair = risky.length ? intercepted.length / risky.length : 0

  const airtSamples = events
    .filter((e) => typeof e.incidentDetectedTsMs === 'number' && typeof e.terminalDecisionTsMs === 'number')
    .map((e) => Math.max(0, (e.terminalDecisionTsMs as number) - (e.incidentDetectedTsMs as number)))
    .sort((a, b) => a - b)

  const airtP50Ms = percentile(airtSamples, 0.5)
  const airtP95Ms = percentile(airtSamples, 0.95)

  const autonomous = events.filter((e) => e.decision === 'allow')
  const governedAutonomous = autonomous.filter((e) => e.hasValidLineage)
  const gar = autonomous.length ? governedAutonomous.length / autonomous.length : 0

  const governedActions = events.filter((e) => e.isTerminal)
  const denialEvents = events.filter((e) => e.decision === 'deny').length
  const replayDetectedEvents = events.filter((e) => e.reasonCode === 'security_replay_detected').length
  const replayGuardUnavailableEvents = events.filter((e) => e.reasonCode === 'security_replay_guard_unavailable').length
  const totalCost = governedActions.reduce(
    (acc, e) =>
      acc +
      (e.humanMinutes ?? 0) +
      (e.computeCostUnits ?? 0) +
      (e.escalationOverheadUnits ?? 0),
    0,
  )
  const tca = governedActions.length ? totalCost / governedActions.length : 0

  return {
    uair,
    airtP50Ms,
    airtP95Ms,
    gar,
    tca,
    totalEvents: events.length,
    denialEvents,
    replayDetectedEvents,
    replayGuardUnavailableEvents,
  }
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const idx = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * p) - 1))
  return values[idx]
}
