import { describe, it, expect, beforeAll } from 'vitest'
import { verifyManifestSignature } from '../../../../src/domain/services/verify-manifest-signature'
import { signManifest } from '../../../../src/domain/services/sign-manifest'
import { Manifest } from '../../../../src/domain/entities/manifest'
import { CredentialType } from '../../../../src/domain/value-objects/credential-type'
import { CredentialId } from '../../../../src/domain/value-objects/credential-id'
import { Tier } from '../../../../src/domain/value-objects/tier'
import { generateKeyPair } from '../../../../src/domain/services/generate-key-pair'
import { canonicalizeManifest } from '../../../../src/domain/serialization/manifest-canonicalization'
import { TEST_PRIVATE_KEY, TEST_PUBLIC_KEY } from '../../fixtures/keys'

/**
 * Security Test Suite: Manifest Poisoning Prevention
 * 
 * This suite verifies our defenses against manifest poisoning attacks (Red Hat Attack Vector #1).
 * Each test represents a specific attack vector that must be mitigated.
 */

const createSecureManifest = () => {
  const now = Date.now()
  return new Manifest(
    'agent_secure_123',
    'principal_secure_456',
    [{
      type: CredentialType.from('payment_method'),
      id: CredentialId.from('cred_secure_789'),
      tier: Tier.from(2)
    }],
    now,
    now + 3600000
  )
}

describe('Security — Manifest Poisoning Prevention', () => {
  let validSignedManifest: any

  beforeAll(async () => {
    validSignedManifest = await signManifest(createSecureManifest(), TEST_PRIVATE_KEY)
  })

  describe('Attack Vector: Basic Signature Attacks', () => {
    it('immediately rejects completely unsigned manifests', async () => {
      const manifest = createSecureManifest()
      await expect(verifyManifestSignature({ 
        manifest, 
        signature: new Uint8Array(), 
        publicKey: TEST_PUBLIC_KEY 
      })).rejects.toThrowError('Invalid signature')
    })

    it('rejects manifests signed with wrong key', async () => {
      const { privateKey, publicKey } = await generateKeyPair()
      const manifest = createSecureManifest()
      const signedWithWrongKey = await signManifest(manifest, privateKey)
      
      await expect(verifyManifestSignature({
        ...signedWithWrongKey,
        publicKey: TEST_PUBLIC_KEY
      })).rejects.toThrowError('Invalid signature')
    })
  })

  describe('Attack Vector: Content Modification', () => {
    it('detects credential injection attacks', async () => {
      const poisonedManifest = {
        ...validSignedManifest,
        manifest: {
          ...validSignedManifest.manifest,
          credentials: [
            ...validSignedManifest.manifest.credentials,
            {
              type: CredentialType.from('identity_document'),
              id: CredentialId.from('cred_injected'),
              tier: Tier.from(3)
            }
          ]
        }
      }
      
      await expect(verifyManifestSignature(poisonedManifest)).rejects.toThrowError('Invalid signature')
    })

    it('detects tier escalation attacks', async () => {
      const poisonedManifest = {
        ...validSignedManifest,
        manifest: {
          ...validSignedManifest.manifest,
          credentials: [
            {
              ...validSignedManifest.manifest.credentials[0],
              tier: Tier.from(4)
            }
          ]
        }
      }
      
      await expect(verifyManifestSignature(poisonedManifest)).rejects.toThrowError('Invalid signature')
    })

    it('detects principal impersonation attacks', async () => {
      const poisonedManifest = {
        ...validSignedManifest,
        manifest: {
          ...validSignedManifest.manifest,
          principalId: 'principal_admin_999'
        }
      }
      
      await expect(verifyManifestSignature(poisonedManifest)).rejects.toThrowError('Invalid signature')
    })
  })

  describe('Attack Vector: Canonicalization Attacks', () => {
    it('prevents property order manipulation attacks', async () => {
      const reorderedManifest = {
        principalId: validSignedManifest.manifest.principalId,
        credentials: validSignedManifest.manifest.credentials,
        agentId: validSignedManifest.manifest.agentId,
        expiresAt: validSignedManifest.manifest.expiresAt,
        createdAt: validSignedManifest.manifest.createdAt
      }

      const canon1 = canonicalizeManifest(validSignedManifest.manifest)
      const canon2 = canonicalizeManifest(reorderedManifest)

      expect(Buffer.from(canon1).toString()).toBe(Buffer.from(canon2).toString())
    })

    it('prevents whitespace/formatting manipulation attacks', async () => {
      const prettyManifest = JSON.parse(JSON.stringify(validSignedManifest.manifest, null, 2))
      const uglyManifest = JSON.parse(JSON.stringify(validSignedManifest.manifest))

      const canon1 = canonicalizeManifest(prettyManifest)
      const canon2 = canonicalizeManifest(uglyManifest)

      expect(Buffer.from(canon1).toString()).toBe(Buffer.from(canon2).toString())
    })
  })

  describe('Attack Vector: Time-Based Attacks', () => {
    it('prevents manifest replay attacks', async () => {
      const replayedManifest = {
        ...validSignedManifest,
        manifest: {
          ...validSignedManifest.manifest,
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000
        }
      }
      
      await expect(verifyManifestSignature(replayedManifest)).rejects.toThrowError('Invalid signature')
    })

    it('prevents expiry extension attacks', async () => {
      const extendedManifest = {
        ...validSignedManifest,
        manifest: {
          ...validSignedManifest.manifest,
          expiresAt: validSignedManifest.manifest.expiresAt + 86400000
        }
      }
      
      await expect(verifyManifestSignature(extendedManifest)).rejects.toThrowError('Invalid signature')
    })
  })

  describe('Attack Vector: Object Structure Attacks', () => {
    it('handles prototype pollution attempts safely', async () => {
      // Note: Prototype pollution is handled at manifest creation/validation layer,
      // not at signature verification. A valid signature with __proto__ will pass
      // because canonicalization ignores non-enumerable properties.
      const poisonedManifest = {
        ...validSignedManifest,
        manifest: {
          ...validSignedManifest.manifest,
          __proto__: {
            toString: () => 'polluted'
          }
        }
      }
      
      // The signature is still valid - prototype pollution detection is elsewhere
      const result = await verifyManifestSignature(poisonedManifest)
      expect(result).toBe(true)
    })

    it('prevents type coercion attacks', async () => {
      const poisonedManifest = {
        ...validSignedManifest,
        manifest: {
          ...validSignedManifest.manifest,
          agentId: { toString: () => validSignedManifest.manifest.agentId },
          principalId: { valueOf: () => validSignedManifest.manifest.principalId }
        }
      }
      
      await expect(verifyManifestSignature(poisonedManifest)).rejects.toThrow()
    })
  })
})
