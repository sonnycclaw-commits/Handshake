import { describe, it, expect } from 'vitest'
import { createManifest } from '@/domain/services/create-manifest'
import { signManifest } from '@/domain/services/sign-manifest'
import { verifyManifestSignature } from '@/domain/services/verify-manifest-signature'
import { Manifest } from '@/domain/entities/manifest'
import { CredentialType } from '@/domain/value-objects/credential-type'
import { CredentialId } from '@/domain/value-objects/credential-id'
import { Tier } from '@/domain/value-objects/tier'
import { TEST_PRIVATE_KEY } from '../../fixtures/keys'

const makeManifest = () => new Manifest(
  'agent_1',
  'principal_1',
  [{ type: CredentialType.from('payment_method'), id: CredentialId.from('cred_123'), tier: Tier.from(0) }],
  Date.now(),
  Date.now() + 60_000
)

describe('Security — Credential injection', () => {
  it('prevents adding unauthorized credential type post-signing', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.manifest.credentials.push({ type: CredentialType.from('identity_document'), id: CredentialId.from('cred_999'), tier: Tier.from(0) })
    await expect(verifyManifestSignature(signed)).rejects.toThrowError('Invalid signature')
  })

  it('prevents swapping credential ids to unauthorized id', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.manifest.credentials[0].id = CredentialId.from('cred_admin')
    await expect(verifyManifestSignature(signed)).rejects.toThrowError('Invalid signature')
  })

  it('prevents altering credential metadata (type or tier) post-signing', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.manifest.credentials[0].type = CredentialType.from('identity_document')
    await expect(verifyManifestSignature(signed)).rejects.toThrowError('Invalid signature')
  })

  it('rejects credential with invalid type during manifest creation', () => {
    const input = {
      agentId: 'agent_1',
      principalId: 'principal_1',
      credentials: [{ type: 'invalid_type', id: 'cred_123', tier: 0 }],
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      version: '1.0'
    }

    expect(() => createManifest(input as any)).toThrowError('Invalid credential type')
  })

  it('rejects credential with invalid id during manifest creation', () => {
    const input = {
      agentId: 'agent_1',
      principalId: 'principal_1',
      credentials: [{ type: 'payment_method', id: '', tier: 0 }],
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      version: '1.0'
    }

    expect(() => createManifest(input as any)).toThrowError('Invalid credential id')
  })
})