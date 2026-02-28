import { describe, it, expect } from 'vitest'
import { createManifest } from '../../../../src/domain/services/create-manifest'
import { CredentialType } from '../../../../src/domain/value-objects/credential-type'
import { CredentialId } from '../../../../src/domain/value-objects/credential-id'

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

describe('createManifest()', () => {
  it('creates a manifest with correct fields', () => {
    const manifest = createManifest(baseInput as any)
    expect(manifest.agentId).toBe(baseInput.agentId)
    expect(manifest.principalId).toBe(baseInput.principalId)
    expect(manifest.createdAt).toBe(baseInput.createdAt)
    expect(manifest.expiresAt).toBe(baseInput.expiresAt)
    expect(manifest.credentials.length).toBe(1)
  })

  it('validates required fields (agentId)', () => {
    const input = { ...baseInput, agentId: undefined }
    expect(() => createManifest(input as any)).toThrowError('agentId is required')
  })

  it('validates required fields (principalId)', () => {
    const input = { ...baseInput, principalId: undefined }
    expect(() => createManifest(input as any)).toThrowError('principalId is required')
  })

  it('validates required fields (credentials)', () => {
    const input = { ...baseInput, credentials: undefined }
    expect(() => createManifest(input as any)).toThrowError('credentials')
  })

  it('rejects empty credentials list (if required)', () => {
    const input = { ...baseInput, credentials: [] }
    expect(() => createManifest(input as any)).toThrowError('credentials')
  })

  it('validates createdAt is number', () => {
    const input = { ...baseInput, createdAt: 'now' as any }
    expect(() => createManifest(input as any)).toThrowError('createdAt must be a number')
  })

  it('validates expiresAt is number', () => {
    const input = { ...baseInput, expiresAt: 'later' as any }
    expect(() => createManifest(input as any)).toThrowError('expiresAt must be a number')
  })

  it('rejects expiresAt in the past', () => {
    const input = { ...baseInput, expiresAt: Date.now() - 1 }
    expect(() => createManifest(input as any)).toThrowError('expiresAt must be in the future')
  })

  it('rejects expiresAt <= createdAt', () => {
    const t = Date.now()
    const input = { ...baseInput, createdAt: t, expiresAt: t }
    expect(() => createManifest(input as any)).toThrowError('expiresAt must be after createdAt')
  })

  it('normalizes and validates credential refs (type/id)', () => {
    const input = {
      ...baseInput,
      credentials: [
        { type: 'invalid_type', id: 'cred_123', tier: 0 }
      ]
    }
    expect(() => createManifest(input as any)).toThrowError('Invalid credential')
  })

  it('preserves credential ordering (if required)', () => {
    const input = {
      ...baseInput,
      credentials: [
        { type: 'payment_method', id: 'cred_1', tier: 0 },
        { type: 'email', id: 'cred_2', tier: 0 }
      ]
    }
    const manifest = createManifest(input as any)
    expect(manifest.credentials[0].type.equals(CredentialType.from('payment_method'))).toBe(true)
    expect(manifest.credentials[1].type.equals(CredentialType.from('email'))).toBe(true)
    expect(manifest.credentials[0].id.equals(CredentialId.from('cred_1'))).toBe(true)
    expect(manifest.credentials[1].id.equals(CredentialId.from('cred_2'))).toBe(true)
  })
})
