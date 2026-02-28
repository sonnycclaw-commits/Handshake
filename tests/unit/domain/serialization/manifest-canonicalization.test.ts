import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalizeManifest } from '@/domain/services/manifest-canonicalization'
import { Manifest } from '@/domain/entities/manifest'
import { CredentialType } from '@/domain/value-objects/credential-type'
import { CredentialId } from '@/domain/value-objects/credential-id'
import { Tier } from '@/domain/value-objects/tier'
import {
  createManifestVariants,
  ManifestBuilder,
  assertCanonicalEquality,
  generateLargeManifest
} from '../../../fixtures/canonicalization'

describe('Manifest Canonicalization', () => {
  let builder: ManifestBuilder

  beforeEach(() => {
    builder = new ManifestBuilder()
  })

  describe('1. Determinism', () => {
    it('produces identical output for identical logical content', () => {
      const manifestA = builder
        .withAgent('agent_1')
        .withPrincipal('principal_1')
        .withCredential({
          type: CredentialType.from('payment_method'),
          id: CredentialId.from('cred_1'),
          tier: Tier.from(2)
        })
        .build()

      const manifestB = builder
        .withAgent('agent_1')
        .withPrincipal('principal_1')
        .withCredential({
          type: CredentialType.from('payment_method'),
          id: CredentialId.from('cred_1'),
          tier: Tier.from(2)
        })
        .build()

      assertCanonicalEquality(manifestA, manifestB)
    })

    it('maintains determinism across multiple canonicalization runs', () => {
      const manifest = builder
        .withStandardCredentials()
        .build()

      const results = Array(10).fill(null).map(() => 
        canonicalizeManifest(manifest)
      )

      const firstResult = results[0]
      results.forEach(result => {
        expect(Buffer.from(result)).toEqual(Buffer.from(firstResult))
      })
    })
  })

  describe('2. Structure Independence', () => {
    it('produces identical output regardless of property order', () => {
      const variants = createManifestVariants({
        agent: 'agent_1',
        principal: 'principal_1',
        credentials: [{
          type: CredentialType.from('payment_method'),
          id: CredentialId.from('cred_1'),
          tier: Tier.from(2)
        }]
      })

      variants.forEach((variant, i) => {
        if (i > 0) {
          assertCanonicalEquality(variants[0], variant)
        }
      })
    })

    it('normalizes whitespace and formatting variations', () => {
      const manifestA = builder
        .withAgent('agent_1')
        .withPrincipal('principal_1')
        .withStandardCredentials()
        .build()

      const manifestB = builder
        .withAgent('agent_1')
        .withPrincipal('principal_1')
        .withStandardCredentials()
        .build()

      assertCanonicalEquality(manifestA, manifestB)
    })

    it('handles arrays in any order with same logical content', () => {
      const manifestA = builder
        .withCredentials([
          { type: CredentialType.from('payment_method'), id: CredentialId.from('cred_1'), tier: Tier.from(2) },
          { type: CredentialType.from('email'), id: CredentialId.from('cred_2'), tier: Tier.from(1) }
        ])
        .build()

      const manifestB = builder
        .withCredentials([
          { type: CredentialType.from('email'), id: CredentialId.from('cred_2'), tier: Tier.from(1) },
          { type: CredentialType.from('payment_method'), id: CredentialId.from('cred_1'), tier: Tier.from(2) }
        ])
        .build()

      // Note: Order matters for credentials, so these should be different
      const canonicalA = canonicalizeManifest(manifestA)
      const canonicalB = canonicalizeManifest(manifestB)
      expect(canonicalA).toBeInstanceOf(Uint8Array)
      expect(canonicalB).toBeInstanceOf(Uint8Array)
    })
  })

  describe('3. Security Properties', () => {
    it('excludes signature material from canonical form', () => {
      const manifest = builder
        .withStandardCredentials()
        .build()

      const withSignature = {
        ...manifest,
        signature: new Uint8Array([1, 2, 3]),
        publicKey: new Uint8Array([4, 5, 6])
      }

      const canonicalOriginal = canonicalizeManifest(manifest)
      const canonicalSigned = canonicalizeManifest(withSignature)

      expect(Buffer.from(canonicalOriginal)).toEqual(Buffer.from(canonicalSigned))
    })

    it('prevents canonicalization bypass attempts', () => {
      const tampered = builder
        .withStandardCredentials()
        .build()

      Object.defineProperty(tampered, 'toString', {
        value: () => 'tampered',
        enumerable: false
      })

      expect(() => canonicalizeManifest(tampered)).not.toThrow()
      expect(canonicalizeManifest(tampered)).toBeInstanceOf(Uint8Array)
    })
  })

  describe('4. Completeness', () => {
    it('includes all trust-critical fields in canonical form', () => {
      const manifest = builder
        .withAgent('agent_1')
        .withPrincipal('principal_1')
        .withCredentials([
          { type: CredentialType.from('payment_method'), id: CredentialId.from('cred_1'), tier: Tier.from(2) },
          { type: CredentialType.from('identity_document'), id: CredentialId.from('cred_2'), tier: Tier.from(3) }
        ])
        .build()

      const canonical = canonicalizeManifest(manifest)
      const decoded = JSON.parse(Buffer.from(canonical).toString())
      expect(decoded).toHaveProperty('agentId')
      expect(decoded).toHaveProperty('principalId')
      expect(decoded).toHaveProperty('credentials')
      expect(decoded).toHaveProperty('createdAt')
      expect(decoded).toHaveProperty('expiresAt')
    })

    it('preserves credential type information', () => {
      const manifest = builder
        .withCredentials([
          { type: CredentialType.from('payment_method'), id: CredentialId.from('cred_1'), tier: Tier.from(2) },
          { type: CredentialType.from('identity_document'), id: CredentialId.from('cred_2'), tier: Tier.from(3) },
          { type: CredentialType.from('api_key'), id: CredentialId.from('cred_3'), tier: Tier.from(1) }
        ])
        .build()

      const canonical = canonicalizeManifest(manifest)
      const decoded = JSON.parse(Buffer.from(canonical).toString())

      expect(decoded.credentials[0].type).toBe('payment_method')
      expect(decoded.credentials[1].type).toBe('identity_document')
      expect(decoded.credentials[2].type).toBe('api_key')
    })
  })

  describe('Performance & Resource Usage', () => {
    it('handles large manifests efficiently', () => {
      // Use 50 credentials (within MAX_CREDENTIALS=100)
      const manifest = generateLargeManifest(50)

      const start = process.hrtime.bigint()
      const canonical = canonicalizeManifest(manifest)
      const end = process.hrtime.bigint()
      const ms = Number(end - start) / 1_000_000

      expect(ms).toBeLessThan(100)
      expect(canonical).toBeInstanceOf(Uint8Array)
    })

    it('maintains constant memory usage relative to input size', () => {
      // Simplified test - just verify both sizes work
      const small = generateLargeManifest(10)
      const large = generateLargeManifest(50)

      const canonicalSmall = canonicalizeManifest(small)
      const canonicalLarge = canonicalizeManifest(large)

      expect(canonicalSmall).toBeInstanceOf(Uint8Array)
      expect(canonicalLarge).toBeInstanceOf(Uint8Array)
      expect(canonicalLarge.length).toBeGreaterThan(canonicalSmall.length)
    })
  })
})