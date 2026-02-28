import { describe, it, expect } from 'vitest'
import { buildTrustPosture } from '@/domain/services/trust-score'

describe('Phase 5 RED: Trust Posture (transparent)', () => {
  it('returns transparent posture with metrics, drivers, and recommendation', () => {
    const posture = buildTrustPosture({
      metrics: {
        requestVolume24h: 100,
        failureRate24h: 0.01,
        failedAuth24h: 0,
        hitlTimeoutRate24h: 0,
        incidents24h: 0,
        anomalies24h: 0
      }
    } as any)

    expect(posture.status).toMatch(/stable|degraded|unstable/)
    expect(posture.metrics).toBeDefined()
    expect(Array.isArray(posture.drivers)).toBe(true)
    expect(posture.recommendedMode).toMatch(/auto|hitl_required|restricted/)
  })

  it('degrades quickly under fault spikes (fast-down)', () => {
    const posture = buildTrustPosture({
      metrics: {
        requestVolume24h: 300,
        failureRate24h: 0.25,
        failedAuth24h: 8,
        hitlTimeoutRate24h: 0.2,
        incidents24h: 2,
        anomalies24h: 5
      }
    } as any)

    expect(posture.status).toMatch(/degraded|unstable/)
    expect(posture.recommendedMode).not.toBe('auto')
  })
})
