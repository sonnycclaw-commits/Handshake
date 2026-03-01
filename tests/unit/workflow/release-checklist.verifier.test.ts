import { describe, it, expect } from 'vitest'
import { buildReleaseChecklistPayload } from '../../../scripts/generate-release-checklist.mjs'
import { verifyReleaseChecklistPayload } from '../../../scripts/check-release-checklist.mjs'

describe('W4-D4 release checklist verifier', () => {
  it('passes on generated checklist payload', () => {
    const payload = buildReleaseChecklistPayload(new Date('2026-03-01T00:00:00Z'))
    expect(() => verifyReleaseChecklistPayload(payload, Date.parse('2026-03-01T00:10:00Z'))).not.toThrow()
  })

  it('fails when required gate is not pass', () => {
    const payload = buildReleaseChecklistPayload(new Date('2026-03-01T00:00:00Z'))
    payload.gates['test:prod-gate'] = 'fail'
    expect(() => verifyReleaseChecklistPayload(payload, Date.parse('2026-03-01T00:10:00Z')))
      .toThrow(/RELEASE_CHECKLIST_GATE_NOT_PASSING:test:prod-gate/)
  })
})
