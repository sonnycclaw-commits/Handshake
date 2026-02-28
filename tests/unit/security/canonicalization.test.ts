import { describe, it, expect } from 'vitest'
import { canonicalizeManifest } from '../../../../src/domain/services/manifest-canonicalization'
import { Manifest } from '../../../../src/domain/entities/manifest'
import { CredentialType } from '../../../../src/domain/value-objects/credential-type'
import { CredentialId } from '../../../../src/domain/value-objects/credential-id'
import { Tier } from '../../../../src/domain/value-objects/tier'

const makeManifest = (credentialsOrder: 'ab' | 'ba' = 'ab') => {
  const creds = [
    { type: CredentialType.from('payment_method'), id: CredentialId.from('cred_a'), tier: Tier.TIER_0 },
    { type: CredentialType.from('email'), id: CredentialId.from('cred_b'), tier: Tier.TIER_0 }
  ]
  const credentials = credentialsOrder === 'ab' ? creds : [creds[1], creds[0]]

  return new Manifest('agent_1', 'principal_1', credentials, Date.now(), Date.now() + 60_000)
}

describe('Manifest Canonicalization', () => {
  it('enforces strict canonical format', () => {
    const manifest = makeManifest('ab')
    const canonical = canonicalizeManifest(manifest as any)
    expect(canonical).toBeInstanceOf(Uint8Array)
  })

  it('rejects non-canonical variations', () => {
    const manifest = makeManifest('ab')
    const canonical = canonicalizeManifest(manifest as any)
    const tampered = new Uint8Array(canonical)
    tampered[0] = tampered[0] ^ 0xff
    expect(Buffer.from(canonical)).not.toEqual(Buffer.from(tampered))
  })

  it('handles canonical ordering of arrays', () => {
    const manifestA = makeManifest('ab')
    const manifestB = makeManifest('ba')

    const canonicalA = canonicalizeManifest(manifestA as any)
    const canonicalB = canonicalizeManifest(manifestB as any)

    expect(Buffer.from(canonicalA)).toEqual(Buffer.from(canonicalB))
  })
})
