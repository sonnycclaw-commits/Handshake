import { describe, it, expect, vi } from 'vitest'
import { verifyManifestSignature } from '@/domain/services/verify-manifest-signature'
import { signManifest } from '@/domain/services/sign-manifest'
import { Manifest } from '@/domain/entities/manifest'
import { CredentialType } from '@/domain/value-objects/credential-type'
import { CredentialId } from '@/domain/value-objects/credential-id'
import { Tier } from '@/domain/value-objects/tier'
import { TEST_PRIVATE_KEY, OTHER_PRIVATE_KEY } from '../../fixtures/keys'

const makeManifest = (overrides: Partial<{ createdAt: number; expiresAt: number; agentId: string; principalId: string }> = {}) => {
  const now = Date.now()
  return new Manifest(
    overrides.agentId ?? 'agent_1',
    overrides.principalId ?? 'principal_1',
    [{ type: CredentialType.from('payment_method'), id: CredentialId.from('cred_1'), tier: Tier.from(0) }],
    overrides.createdAt ?? now,
    overrides.expiresAt ?? now + 60_000
  )
}

describe('Time-based Attacks', () => {
  it('rejects manifest with suspicious creation time gap', async () => {
    const futureTime = Date.now() + 10 * 60_000
    const manifest = makeManifest({ createdAt: futureTime, expiresAt: futureTime + 60_000 })
    const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

    await expect(verifyManifestSignature(signed)).rejects.toThrow()
  })

  it('rejects manifest replay across different dates', async () => {
    const now = Date.now()
    const manifest = makeManifest({ createdAt: now, expiresAt: now + 1000 })
    const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

    vi.setSystemTime(now + 24 * 60 * 60 * 1000)
    const expired = signed.manifest.isExpired()
    vi.useRealTimers()

    expect(expired).toBe(true)
  })

  it('rejects manifest replayed after rotation', async () => {
    const manifest = makeManifest()
    const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

    const rotated = await signManifest(manifest, OTHER_PRIVATE_KEY)
    await expect(verifyManifestSignature({ ...signed, publicKey: rotated.publicKey } as any)).rejects.toThrow()
  })
})

describe('Advanced Replay Attacks', () => {
  it('prevents cross-context manifest replay', async () => {
    const manifest = makeManifest({ principalId: 'principal_A' })
    const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

    const wrongContext = { ...signed, manifest: makeManifest({ principalId: 'principal_B' }) } as any
    await expect(verifyManifestSignature(wrongContext)).rejects.toThrowError('Invalid signature')
  })

  it('invalidates manifests after key rotation', async () => {
    const manifest = makeManifest()
    const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

    const rotated = await signManifest(manifest, OTHER_PRIVATE_KEY)
    await expect(verifyManifestSignature({ ...signed, publicKey: rotated.publicKey } as any)).rejects.toThrowError('Invalid signature')
  })

  it('detects manifest reuse across agents', async () => {
    const manifest = makeManifest({ agentId: 'agent_1' })
    const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

    const reused = { ...signed, manifest: makeManifest({ agentId: 'agent_2' }) } as any
    await expect(verifyManifestSignature(reused)).rejects.toThrowError('Invalid signature')
  })
})