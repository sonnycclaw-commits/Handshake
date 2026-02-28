import { describe, it, expect } from 'vitest'
import { generateIncidentReport } from '@/domain/services/incident-report'

describe('Phase 5 RED: Incident Report', () => {
  it('builds incident report with timeline and affected actors', () => {
    const report = generateIncidentReport({ incidentId: 'inc_001' } as any)
    expect(report.timeline).toBeDefined()
    expect(report.affectedActors).toBeDefined()
  })
})
