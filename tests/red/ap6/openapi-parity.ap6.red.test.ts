import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('AP6 W3 RED — OpenAPI contract parity', () => {
  it('requires canonical OpenAPI spec file', () => {
    const specPath = resolve(process.cwd(), 'openapi/handshake.v1.yaml')
    // RED: spec does not exist yet.
    expect(existsSync(specPath)).toBe(true)
  })

  it('requires OpenAPI to include all core rails', () => {
    const specPath = resolve(process.cwd(), 'openapi/handshake.v1.yaml')
    expect(existsSync(specPath)).toBe(true)
    const raw = existsSync(specPath) ? readFileSync(specPath, 'utf8') : ''

    expect(raw.includes('/workflow/requests')).toBe(true)
    expect(raw.includes('/workflow/decision-room/{requestId}')).toBe(true)
    expect(raw.includes('/workflow/decision-room/action')).toBe(true)
    expect(raw.includes('/workflow/evidence/{requestId}')).toBe(true)

    expect(raw.includes('/policy/config')).toBe(true)
    expect(raw.includes('/policy/simulate')).toBe(true)
    expect(raw.includes('/policy/apply')).toBe(true)

    expect(raw.includes('/metrics/summary')).toBe(true)
    expect(raw.includes('/metrics/series')).toBe(true)
    expect(raw.includes('/metrics/reasons')).toBe(true)

    expect(raw.includes('/agents')).toBe(true)
    expect(raw.includes('/agents/{agentId}')).toBe(true)
    expect(raw.includes('/entities')).toBe(true)
    expect(raw.includes('/entities/{entityId}')).toBe(true)
  })

  it('requires reasonCode + responseClass in canonical error schema', () => {
    const specPath = resolve(process.cwd(), 'openapi/handshake.v1.yaml')
    expect(existsSync(specPath)).toBe(true)
    const raw = existsSync(specPath) ? readFileSync(specPath, 'utf8') : ''

    // RED: should fail until schema component is explicitly defined.
    expect(raw.includes('reasonCode')).toBe(true)
    expect(raw.includes('responseClass')).toBe(true)
    expect(raw.includes('error')).toBe(true)
  })
})
