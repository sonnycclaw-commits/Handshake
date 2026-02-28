import { describe, it, expect } from 'vitest'
import { verifyManifestSignature } from '../../../../src/domain/services/verify-manifest-signature'
import { signManifest } from '../../../../src/domain/services/sign-manifest'
import { Manifest } from '../../../../src/domain/entities/manifest'
import { CredentialType } from '../../../../src/domain/value-objects/credential-type'
import { CredentialId } from '../../../../src/domain/value-objects/credential-id'
import { Tier } from '../../../../src/domain/value-objects/tier'
import { TEST_PRIVATE_KEY } from '../../fixtures/keys'

const makeManifest = () => new Manifest(
  'agent_1',
  'principal_1',
  [
    { type: CredentialType.from('payment_method'), id: CredentialId.from('cred_1'), tier: Tier.from(0) },
    { type: CredentialType.from('email'), id: CredentialId.from('cred_2'), tier: Tier.from(0) }
  ],
  Date.now(),
  Date.now() + 60_000
)

describe('Security — Tamper detection', () => {
  it('fails verification when any byte in signature is modified', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.signature[0] = signed.signature[0] ^ 0xff
    await expect(verifyManifestSignature(signed)).rejects.toThrowError('Invalid signature')
  })

  it('fails verification when any byte in public key is modified', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.publicKey[0] = signed.publicKey[0] ^ 0xff
    await expect(verifyManifestSignature(signed)).rejects.toThrowError('Invalid signature')
  })

  it('fails verification when any manifest field is modified', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    ;(signed.manifest as any).createdAt = Date.now() + 123
    await expect(verifyManifestSignature(signed)).rejects.toThrowError('Invalid signature')
  })

  it('verifies correctly when credentials order changes (canonical order is enforced)', async () => {
    // Canonicalization sorts credentials by type, so order in manifest doesn't matter
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    const [a, b] = signed.manifest.credentials
    signed.manifest.credentials = [b, a] as any
    // Signature still valid because canonical form is the same
    const result = await verifyManifestSignature(signed)
    expect(result).toBe(true)
  })
})
