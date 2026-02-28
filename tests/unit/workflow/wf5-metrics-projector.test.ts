import { describe, it, expect } from 'vitest'
import { computeMetricsSummary } from '@/domain/services/wf5-metrics-projector'

describe('WF5 Metrics Projector', () => {
  it('computes UAIR/GAR/TCA and AIRT percentiles deterministically', () => {
    const summary = computeMetricsSummary([
      {
        eventId: 'e1', requestId: 'r1', timestampMs: 1,
        decision: 'deny', reasonCode: 'policy_denied', reasonFamily: 'policy', riskTier: 'high',
        isTerminal: true, hasValidLineage: true, incidentDetectedTsMs: 1000, terminalDecisionTsMs: 4000,
        humanMinutes: 1, computeCostUnits: 0.2, escalationOverheadUnits: 0.1,
      },
      {
        eventId: 'e2', requestId: 'r2', timestampMs: 2,
        decision: 'allow', reasonCode: 'policy_allow', reasonFamily: 'policy', riskTier: 'high',
        isTerminal: true, hasValidLineage: true, incidentDetectedTsMs: 1000, terminalDecisionTsMs: 2000,
        humanMinutes: 0, computeCostUnits: 0.1, escalationOverheadUnits: 0,
      },
      {
        eventId: 'e3', requestId: 'r3', timestampMs: 3,
        decision: 'allow', reasonCode: 'policy_allow', reasonFamily: 'policy', riskTier: 'low',
        isTerminal: true, hasValidLineage: false,
        humanMinutes: 0, computeCostUnits: 0.1, escalationOverheadUnits: 0,
      },
    ])

    expect(summary.uair).toBeCloseTo(0.5)
    expect(summary.gar).toBeCloseTo(0.5)
    expect(summary.airtP50Ms).toBe(1000)
    expect(summary.airtP95Ms).toBe(3000)
    expect(summary.tca).toBeCloseTo((1.3 + 0.1 + 0.1) / 3)
  })

  it('fail-safe zeroes when no samples exist', () => {
    const summary = computeMetricsSummary([])
    expect(summary.uair).toBe(0)
    expect(summary.airtP50Ms).toBe(0)
    expect(summary.airtP95Ms).toBe(0)
    expect(summary.gar).toBe(0)
    expect(summary.tca).toBe(0)
  })
})
