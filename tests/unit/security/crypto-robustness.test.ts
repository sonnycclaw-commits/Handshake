import { describe, it, expect } from 'vitest'
import { verifyManifestSignature } from '../../../../src/domain/services/verify-manifest-signature'
import { signManifest } from '../../../../src/domain/services/sign-manifest'
import { Manifest } from '../../../../src/domain/entities/manifest'
import { CredentialType } from '../../../../src/domain/value-objects/credential-type'
import { CredentialId } from '../../../../src/domain/value-objects/credential-id'
import { Tier } from '../../../../src/domain/value-objects/tier'
import { TEST_PRIVATE_KEY, INVALID_PUBLIC_KEY, NON_CANONICAL_PUBLIC_KEY, ZERO_PUBLIC_KEY, NON_CANONICAL_SIGNATURE } from '../../fixtures/keys'

const makeManifest = () => new Manifest(
  'agent_1',
  'principal_1',
  [{ type: CredentialType.from('payment_method'), id: CredentialId.from('cred_1'), tier: Tier.from(0) }],
  Date.now(),
  Date.now() + 60_000
)

describe('Ed25519 Key Validation', () => {
  it('rejects malformed public keys', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.publicKey = INVALID_PUBLIC_KEY as any

    await expect(verifyManifestSignature(signed)).rejects.toThrow()
  })

  it('rejects non-canonical public keys', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.publicKey = NON_CANONICAL_PUBLIC_KEY as any

    await expect(verifyManifestSignature(signed)).rejects.toThrow()
  })

  it('rejects public key of all zeros', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.publicKey = ZERO_PUBLIC_KEY as any

    await expect(verifyManifestSignature(signed)).rejects.toThrow()
  })
})

describe('Signature Malleability Protection', () => {
  it('rejects non-canonical S value in signature', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.signature = NON_CANONICAL_SIGNATURE as any

    await expect(verifyManifestSignature(signed)).rejects.toThrow()
  })

  it('rejects signature with invalid R point encoding', async () => {
    const signed = await signManifest(makeManifest(), TEST_PRIVATE_KEY)
    signed.signature = NON_CANONICAL_SIGNATURE as any

    await expect(verifyManifestSignature(signed)).rejects.toThrow()
  })
})