import { describe, it, expect } from 'vitest'
import { aggregateRiskSignals } from '@/domain/services/risk-signal-aggregation'

describe('Phase 5 RED: Risk Signal Aggregation', () => {
  it('aggregates signals into deterministic risk level', () => {
    const risk = aggregateRiskSignals({
      anomalies: 2,
      failedAuth: 1,
      timeoutRate: 0.1
    } as any)

    expect(risk.level).toMatch(/low|medium|high|critical/)
  })
})
