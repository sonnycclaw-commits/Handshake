import { describe, it, expect } from 'vitest'
import { SignedManifest } from '../../../../src/domain/entities/signed-manifest'
import { Manifest } from '../../../../src/domain/entities/manifest'
import { CredentialType } from '../../../../src/domain/value-objects/credential-type'
import { CredentialId } from '../../../../src/domain/value-objects/credential-id'
import { Tier } from '../../../../src/domain/value-objects/tier'
import { TEST_PRIVATE_KEY, TEST_PUBLIC_KEY, OTHER_PRIVATE_KEY, OTHER_PUBLIC_KEY } from '../../fixtures/keys'
import { signManifest } from '../../../../src/domain/services/sign-manifest'

const makeManifest = () => new Manifest(
  'agent_1',
  'principal_1',
  [{ type: CredentialType.from('payment_method'), id: CredentialId.from('cred_1'), tier: Tier.from(0) }],
  Date.now(),
  Date.now() + 60_000
)

describe('SignedManifest', () => {
  it('creates signed manifest with manifest + signature + publicKey', () => {
    const manifest = makeManifest()
    const signature = new Uint8Array([1, 2, 3])
    const publicKey = new Uint8Array([4, 5, 6])

    const signed = new SignedManifest(manifest, signature, publicKey)

    expect(signed.manifest).toBe(manifest)
    expect(signed.signature).toBe(signature)
    expect(signed.publicKey).toBe(publicKey)
  })

  it('verify returns true for valid signature', async () => {
    const manifest = makeManifest()
    const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

    const result = await signed.verify()
    expect(result).toBe(true)
  })

  it('verify returns true for valid signature with different key', async () => {
    // Signing with OTHER_PRIVATE_KEY creates a valid signature for that key
    const manifest = makeManifest()
    const signed = await signManifest(manifest, OTHER_PRIVATE_KEY)

    const result = await signed.verify()
    expect(result).toBe(true)
  })

  it('verify throws if manifest payload mutated after signing', async () => {
    const manifest = makeManifest()
    const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

    ;(manifest.credentials as any).push({ type: CredentialType.from('email'), id: CredentialId.from('cred_2'), tier: Tier.from(0) })

    await expect(signed.verify()).rejects.toThrowError('Invalid signature')
  })

  it('verify throws if signature bytes are altered', async () => {
    const manifest = makeManifest()
    const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

    signed.signature[0] = signed.signature[0] ^ 0xff

    await expect(signed.verify()).rejects.toThrowError('Invalid signature')
  })

  it('verify throws if public key is altered', async () => {
    const manifest = makeManifest()
    const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

    signed.publicKey = OTHER_PUBLIC_KEY as any

    await expect(signed.verify()).rejects.toThrowError('Invalid signature')
  })

  it('verify throws for empty signature', async () => {
    const manifest = makeManifest()
    const signed = new SignedManifest(manifest, new Uint8Array(), TEST_PUBLIC_KEY)

    await expect(signed.verify()).rejects.toThrowError('Invalid signature')
  })

  it('verify throws for empty public key', async () => {
    const manifest = makeManifest()
    const signed = new SignedManifest(manifest, new Uint8Array([1,2,3]), new Uint8Array())

    await expect(signed.verify()).rejects.toThrowError('Invalid public key')
  })
})
