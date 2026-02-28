import { describe, it, expect } from 'vitest'
import { createManifest } from '../../../../src/domain/services/create-manifest'

const baseInput = {
  agentId: 'agent_123',
  principalId: 'principal_456',
  credentials: [
    { type: 'payment_method', id: 'cred_123', tier: 0 }
  ],
  createdAt: Date.now(),
  expiresAt: Date.now() + 60_000,
  version: '1.0'
}

const buildNested = (depth: number) => {
  let current: any = { value: 'root' }
  const root = current
  for (let i = 1; i < depth; i += 1) {
    current.child = { value: `level_${i}` }
    current = current.child
  }
  return root
}

describe('Manifest Depth Limit', () => {
  const MAX_DEPTH = 10

  it('rejects manifest with nesting > MAX_DEPTH', () => {
    const deep = buildNested(MAX_DEPTH + 2)
    expect(() => createManifest({ ...baseInput, metadata: deep } as any)).toThrow()
  })

  it('accepts manifest at MAX_DEPTH', () => {
    const deep = buildNested(MAX_DEPTH - 1) // Manifest root counts as 1
    expect(() => createManifest({ ...baseInput, metadata: deep } as any)).not.toThrow()
  })

  it('counts manifest root as depth 1', () => {
    const depthOne = { value: 'root' }
    expect(() => createManifest({ ...baseInput, metadata: depthOne } as any)).not.toThrow()
  })

  it('rejects circular references', () => {
    const circular: any = { value: 'root' }
    circular.self = circular
    expect(() => createManifest({ ...baseInput, metadata: circular } as any)).toThrow()
  })
})