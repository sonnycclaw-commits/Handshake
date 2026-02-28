import { describe, it, expect } from 'vitest'
import { activateEmergencyControl } from '../../../../src/domain/services/emergency-controls'

describe('Phase 5 RED: Emergency Controls', () => {
  it('activates global deny mode with audit reason', () => {
    const res = activateEmergencyControl({ mode: 'global_deny', reason: 'incident' } as any)
    expect(res.active).toBe(true)
    expect(res.mode).toBe('global_deny')
  })
})
