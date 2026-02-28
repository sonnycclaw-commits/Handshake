import { describe, it, expect } from 'vitest'
import { createManifest } from '@/domain/services/create-manifest'

const baseInput = {
  agentId: 'agent_123',
  principalId: 'principal_456',
  credentials: [
    { type: 'payment_method', id: 'cred_123', tier: 0 }
  ],
  createdAt: Date.now(),
  expiresAt: Date.now() + 60_000
}

describe('Manifest Version', () => {
  const CURRENT_VERSION = '1.0'
  const MIN_VERSION = '1.0'

  it('includes version field in manifest', () => {
    const manifest = createManifest({ ...baseInput, version: CURRENT_VERSION } as any)
    expect((manifest as any).version).toBe(CURRENT_VERSION)
  })

  it('rejects manifests with version below minimum', () => {
    expect(() => createManifest({ ...baseInput, version: '0.9' } as any)).toThrow()
  })

  it('rejects manifests without version field', () => {
    expect(() => createManifest({ ...baseInput, version: undefined } as any)).toThrow()
  })

  it('accepts current version', () => {
    expect(() => createManifest({ ...baseInput, version: CURRENT_VERSION } as any)).not.toThrow()
  })

  it('version is string, not number', () => {
    expect(() => createManifest({ ...baseInput, version: 1.0 } as any)).toThrow()
  })
})
