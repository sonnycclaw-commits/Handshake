import { describe, it, expect } from 'vitest'
import { verifyManifestSignature } from '@/domain/services/verify-manifest-signature'
import { signManifest } from '@/domain/services/sign-manifest'
import { Manifest } from '@/domain/entities/manifest'
import { CredentialType } from '@/domain/value-objects/credential-type'
import { CredentialId } from '@/domain/value-objects/credential-id'
import { Tier } from '@/domain/value-objects/tier'
import { TEST_PRIVATE_KEY, OTHER_PRIVATE_KEY, OTHER_PUBLIC_KEY } from '../../fixtures/keys'

const makeManifest = () => new Manifest(
  'agent_1',
  'principal_1',
  [{ type: CredentialType.from('payment_method'), id: CredentialId.from('cred_1'), tier: Tier.TIER_0 }],
  Date.now(),
  Date.now() + 60_000
)

describe('verifyManifestSignature()', () => {
  it('returns true for valid signed manifest', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    const result = await verifyManifestSignature(signed)
    expect(result).toBe(true)
  })

  it('returns true for valid signature with different key', async () => {
    // Signing with OTHER_PRIVATE_KEY creates a valid signature for that key
    const signed = await signManifest(makeManifest(), OTHER_PRIVATE_KEY)
    const result = await verifyManifestSignature(signed)
    expect(result).toBe(true)
  })

  it('throws when manifest payload mutated', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    ;(signed.manifest.credentials as any).push({ type: CredentialType.from('email'), id: CredentialId.from('cred_2'), tier: Tier.TIER_0 })
    await expect(verifyManifestSignature(signed)).rejects.toThrowError('Invalid signature')
  })

  it('throws when public key is tampered', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.publicKey = OTHER_PUBLIC_KEY as any
    await expect(verifyManifestSignature(signed)).rejects.toThrowError('Invalid signature')
  })

  it('throws when signature bytes tampered', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.signature[0] = signed.signature[0] ^ 0xff
    await expect(verifyManifestSignature(signed)).rejects.toThrowError('Invalid signature')
  })

  it('throws for missing signature', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.signature = new Uint8Array()
    await expect(verifyManifestSignature(signed)).rejects.toThrowError('Invalid signature')
  })

  it('throws for missing public key', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.publicKey = new Uint8Array()
    await expect(verifyManifestSignature(signed)).rejects.toThrowError('Invalid public key')
  })

  it('throws or returns false for invalid manifest input', async () => {
    await expect(verifyManifestSignature(null as any)).rejects.toThrowError('Invalid signed manifest')
  })
})
