import { describe, it, expect } from 'vitest'
import { KNOWN_REASON_CODES, toResponseClass } from '@/domain/constants/reason-codes'
import { statusForReasonCodeStrict } from '@/domain/constants/reason-code-http'

describe('reason code contract invariants (Slice 4)', () => {
  it('all known reason codes map to deterministic HTTP status', () => {
    for (const code of KNOWN_REASON_CODES) {
      expect(() => statusForReasonCodeStrict(code)).not.toThrow()
      const status = statusForReasonCodeStrict(code)
      expect([400, 401, 403, 404, 409, 422, 503]).toContain(status)
    }
  })

  it('all known reason codes produce non-unknown responseClass when denied', () => {
    for (const code of KNOWN_REASON_CODES) {
      const cls = toResponseClass({ decision: 'deny', reasonCode: code })
      expect(cls).not.toBe('unknown')
    }
  })

  it('allow decision always maps to ok responseClass for known reason codes', () => {
    for (const code of KNOWN_REASON_CODES) {
      const cls = toResponseClass({ decision: 'allow', reasonCode: code })
      expect(cls).toBe('ok')
    }
  })
})
