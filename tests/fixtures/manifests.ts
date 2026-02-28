import type { Manifest } from '@/domain/entities/manifest'
import type { CredentialRef } from '@/domain/value-objects/credential-ref'

export const baseCredentials: CredentialRef[] = [
  {
    type: { value: 'payment_method' } as any,
    id: { value: 'cred_123' } as any,
    tier: { level: 0, name: 'Auto-approved' } as any
  },
  {
    type: { value: 'identity_document' } as any,
    id: { value: 'cred_456' } as any,
    tier: { level: 2, name: 'One-tap' } as any
  }
]

export const baseManifestParams = {
  agentId: 'agent_123',
  principalId: 'principal_456',
  credentials: baseCredentials,
  createdAt: Date.now() - 1000,
  expiresAt: Date.now() + 60_000
}

export const expiredManifestParams = {
  ...baseManifestParams,
  expiresAt: Date.now() - 1
}

export const futureCreatedManifestParams = {
  ...baseManifestParams,
  createdAt: Date.now() + 5 * 60_000
}

// For testing credential count limit (>1000)
export const oversizedManifestCredentials: CredentialRef[] = Array.from({ length: 1001 }).map((_, idx) => ({
  type: { value: 'payment_method' } as any,
  id: { value: `cred_${idx}` } as any,
  tier: { level: 0, name: 'Auto-approved' } as any
}))

// For testing 1MB size limit (fewer credentials with large string values)
// Creates ~1.1MB manifest with 100 credentials each having ~11KB data
export const largeManifestCredentials = Array.from({ length: 100 }).map((_, idx) => ({
  type: { value: 'payment_method' } as any,
  id: { value: `cred_${idx}` } as any,
  tier: { level: 0, name: 'Auto-approved' } as any,
  name: 'x'.repeat(11000) // Large string to hit 1MB with fewer credentials
}))

export const buildManifest = (overrides: Partial<typeof baseManifestParams> = {}): Manifest => {
  const params = { ...baseManifestParams, ...overrides }
  return new (class {
    agentId = params.agentId
    principalId = params.principalId
    credentials = params.credentials
    createdAt = params.createdAt
    expiresAt = params.expiresAt
    isExpired() { return Date.now() > params.expiresAt }
  })() as Manifest
}
