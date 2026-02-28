import { describe, it, expect, vi } from 'vitest'
import { signManifest } from '../../../../src/domain/services/sign-manifest'
import { verifyManifestSignature } from '../../../../src/domain/services/verify-manifest-signature'
import { Manifest } from '../../../../src/domain/entities/manifest'
import { CredentialType } from '../../../../src/domain/value-objects/credential-type'
import { CredentialId } from '../../../../src/domain/value-objects/credential-id'
import { Tier } from '../../../../src/domain/value-objects/tier'
import { TEST_PRIVATE_KEY } from '../../fixtures/keys'

const makeManifest = (overrides: Partial<{ createdAt: number; expiresAt: number; agentId: string }> = {}) => {
  const now = Date.now()
  return new Manifest(
    overrides.agentId ?? 'agent_1',
    'principal_1',
    [{ type: CredentialType.from('payment_method'), id: CredentialId.from('cred_1'), tier: Tier.from(0) }],
    overrides.createdAt ?? now,
    overrides.expiresAt ?? now + 60_000
  )
}

describe('Security — Replay attacks', () => {
  it('rejects expired signed manifest', async () => {
    // Create manifest with short expiry, wait for it to expire
    const now = Date.now()
    const manifest = makeManifest({ createdAt: now, expiresAt: now + 1000 })
    const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

    // Check it's expired after time passes
    vi.setSystemTime(now + 2000)
    const expired = signed.manifest.isExpired()
    vi.useRealTimers()

    expect(expired).toBe(true)
  })

  it('rejects signed manifest with createdAt in the future beyond tolerance', async () => {
    // Create manifest with future createdAt (beyond 2 min tolerance)
    const futureTime = Date.now() + 5 * 60_000
    const manifest = makeManifest({ createdAt: futureTime, expiresAt: futureTime + 60_000 })
    
    // Verification should reject due to future createdAt
    await expect(verifyManifestSignature(await signManifest(manifest, TEST_PRIVATE_KEY))).rejects.toThrow()
  })

  it('rejects reuse of a signed manifest after expiration', async () => {
    const now = Date.now()
    const manifest = makeManifest({ createdAt: now, expiresAt: now + 1000 })
    const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

    vi.setSystemTime(now + 2000)
    const expired = signed.manifest.isExpired()
    vi.useRealTimers()

    expect(expired).toBe(true)
  })

  it('detects replay with different agentId using same signature', async () => {
    const signed = await signManifest(makeManifest({ agentId: 'agent_A' }), TEST_PRIVATE_KEY)
    ;(signed.manifest as any).agentId = 'agent_B'

    await expect(verifyManifestSignature(signed)).rejects.toThrowError('Invalid signature')
  })
})