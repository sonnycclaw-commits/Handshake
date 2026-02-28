type TrustMetrics = {
  requestVolume24h: number
  failureRate24h: number
  failedAuth24h: number
  hitlTimeoutRate24h: number
  incidents24h: number
  anomalies24h: number
}

type BuildTrustPostureInput = {
  metrics: TrustMetrics
}

type TrustStatus = 'stable' | 'degraded' | 'unstable'
type RecommendedMode = 'auto' | 'hitl_required' | 'restricted'

export type TrustPosture = {
  status: TrustStatus
  metrics: TrustMetrics
  drivers: string[]
  recommendedMode: RecommendedMode
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateMetrics(metrics: TrustMetrics): void {
  const entries = Object.entries(metrics)
  for (const [, value] of entries) {
    if (!isFiniteNumber(value)) throw new Error('invalid_input: metrics must be finite numbers')
  }

  if (metrics.requestVolume24h < 0) throw new Error('invalid_input: requestVolume24h must be >= 0')
  if (metrics.failureRate24h < 0 || metrics.failureRate24h > 1) throw new Error('invalid_input: failureRate24h must be 0..1')
  if (metrics.hitlTimeoutRate24h < 0 || metrics.hitlTimeoutRate24h > 1) throw new Error('invalid_input: hitlTimeoutRate24h must be 0..1')
  if (metrics.failedAuth24h < 0 || metrics.incidents24h < 0 || metrics.anomalies24h < 0) {
    throw new Error('invalid_input: count metrics must be >= 0')
  }
}

export function buildTrustPosture(input: BuildTrustPostureInput): TrustPosture {
  if (!input || typeof input !== 'object' || !input.metrics) {
    throw new Error('invalid_input: metrics are required')
  }

  const metrics = input.metrics
  validateMetrics(metrics)

  const drivers: string[] = []

  if (metrics.failureRate24h >= 0.2) drivers.push('high_failure_rate')
  else if (metrics.failureRate24h >= 0.05) drivers.push('elevated_failure_rate')

  if (metrics.failedAuth24h >= 5) drivers.push('failed_auth_spike')
  else if (metrics.failedAuth24h > 0) drivers.push('failed_auth_activity')

  if (metrics.hitlTimeoutRate24h >= 0.15) drivers.push('high_hitl_timeout_rate')
  else if (metrics.hitlTimeoutRate24h >= 0.05) drivers.push('elevated_hitl_timeout_rate')

  if (metrics.incidents24h > 0) drivers.push('recent_incidents')
  if (metrics.anomalies24h >= 5) drivers.push('anomaly_spike')
  else if (metrics.anomalies24h > 0) drivers.push('anomaly_activity')

  let status: TrustStatus = 'stable'
  if (
    metrics.failureRate24h >= 0.2 ||
    metrics.failedAuth24h >= 8 ||
    metrics.hitlTimeoutRate24h >= 0.2 ||
    metrics.incidents24h >= 2
  ) {
    status = 'unstable'
  } else if (
    metrics.failureRate24h >= 0.05 ||
    metrics.failedAuth24h >= 2 ||
    metrics.hitlTimeoutRate24h >= 0.05 ||
    metrics.incidents24h >= 1 ||
    metrics.anomalies24h >= 2
  ) {
    status = 'degraded'
  }

  const recommendedMode: RecommendedMode = status === 'stable' ? 'auto' : status === 'degraded' ? 'hitl_required' : 'restricted'

  return {
    status,
    metrics,
    drivers,
    recommendedMode
  }
}
