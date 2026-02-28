type AggregateRiskSignalsInput = {
  anomalies: number
  failedAuth: number
  timeoutRate: number
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type AggregatedRisk = {
  level: RiskLevel
  score: number
  drivers: string[]
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

export function aggregateRiskSignals(input: AggregateRiskSignalsInput): AggregatedRisk {
  if (!input || typeof input !== 'object') {
    throw new Error('invalid_input: object required')
  }

  if (!isFiniteNumber(input.anomalies) || !isFiniteNumber(input.failedAuth) || !isFiniteNumber(input.timeoutRate)) {
    throw new Error('invalid_input: anomalies, failedAuth, timeoutRate must be finite numbers')
  }

  if (input.anomalies < 0 || input.failedAuth < 0) {
    throw new Error('invalid_input: anomalies and failedAuth must be >= 0')
  }

  if (input.timeoutRate < 0 || input.timeoutRate > 1) {
    throw new Error('invalid_input: timeoutRate must be 0..1')
  }

  const anomalyComponent = Math.min(input.anomalies / 10, 1)
  const authComponent = Math.min(input.failedAuth / 10, 1)
  const timeoutComponent = input.timeoutRate

  const score = clamp01(anomalyComponent * 0.35 + authComponent * 0.4 + timeoutComponent * 0.25)

  const drivers: string[] = []
  if (input.anomalies >= 5) drivers.push('anomaly_spike')
  else if (input.anomalies > 0) drivers.push('anomaly_activity')

  if (input.failedAuth >= 5) drivers.push('failed_auth_spike')
  else if (input.failedAuth > 0) drivers.push('failed_auth_activity')

  if (input.timeoutRate >= 0.2) drivers.push('high_timeout_rate')
  else if (input.timeoutRate >= 0.05) drivers.push('elevated_timeout_rate')

  let level: RiskLevel = 'low'
  if (score >= 0.8 || input.failedAuth >= 10) level = 'critical'
  else if (score >= 0.55 || input.anomalies >= 6) level = 'high'
  else if (score >= 0.25 || input.failedAuth >= 2 || input.anomalies >= 2) level = 'medium'

  return { level, score, drivers }
}
