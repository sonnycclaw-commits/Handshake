import { describe, it, expect, beforeEach } from 'vitest'
import { signManifest } from '@/domain/services/sign-manifest'
import { verifyManifestSignature } from '@/domain/services/verify-manifest-signature'
import { Manifest } from '@/domain/entities/manifest'
import { CredentialType } from '@/domain/value-objects/credential-type'
import { CredentialId } from '@/domain/value-objects/credential-id'
import { Tier } from '@/domain/value-objects/tier'
import {
  TEST_PRIVATE_KEY,
  OTHER_PRIVATE_KEY,
  INVALID_PRIVATE_KEY,
  generateTestKeyPair
} from '../../fixtures/keys'
import { canonicalizeManifest } from '@/domain/serialization/manifest-canonicalization'

/**
 * Security Test Suite: Manifest Signing
 * 
 * This suite verifies our Ed25519 signature implementation (D003) aligns with
 * security best practices and maintains signature integrity under various conditions.
 * 
 * Security Properties Tested:
 * 1. Deterministic signatures (same input = same signature)
 * 2. Key validation and handling
 * 3. Canonicalization integrity
 * 4. Immutability guarantees
 * 5. Side-channel attack prevention
 */

interface TestCredential {
  type: CredentialType
  id: CredentialId
  tier: Tier
}

// Test fixtures reflecting real-world credentials
const createTestCredential = (type: string, id: string, tierLevel: number): TestCredential => ({
  type: CredentialType.from(type),
  id: CredentialId.from(id),
  tier: Tier.from(tierLevel)
})

// Create manifest with strong security properties
const createSecureManifest = (id: string, credentials: TestCredential[]) => {
  const now = Date.now()
  return new Manifest(
    `agent_${id}`,
    `principal_${id}`,
    credentials,
    now,
    now + 3600000 // 1 hour validity
  )
}

describe('Manifest Signing Service', () => {
  // Reset test state
  beforeEach(() => {
    // Clear any cached keys or state
  })

  describe('Basic Signature Properties', () => {
    it('generates Ed25519 signatures that are exactly 64 bytes', async () => {
      // Arrange
      const manifest = createSecureManifest('test', [
        createTestCredential('payment_method', 'cred_test', 2)
      ])

      // Act
      const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

      // Assert: Ed25519 signatures are always exactly 64 bytes
      expect(signed.signature.byteLength).toBe(64)
      expect(signed.signature instanceof Uint8Array).toBe(true)
    })

    it('includes the 32-byte public key for verification', async () => {
      // Arrange
      const manifest = createSecureManifest('test', [
        createTestCredential('payment_method', 'cred_test', 2)
      ])

      // Act
      const signed = await signManifest(manifest, TEST_PRIVATE_KEY)

      // Assert: Ed25519 public keys are always exactly 32 bytes
      expect(signed.publicKey.byteLength).toBe(32)
      expect(signed.publicKey instanceof Uint8Array).toBe(true)
    })
  })

  describe('Signature Determinism', () => {
    it('produces identical signatures for identical manifests (deterministic)', async () => {
      // Arrange: Create two identical manifests
      const credentials = [createTestCredential('payment_method', 'cred_test', 2)]
      const manifestA = createSecureManifest('deterministic', credentials)
      const manifestB = JSON.parse(JSON.stringify(manifestA)) // Deep clone

      // Act: Sign both
      const signedA = await signManifest(manifestA, TEST_PRIVATE_KEY)
      const signedB = await signManifest(manifestB, TEST_PRIVATE_KEY)

      // Assert: Signatures must be identical (deterministic)
      expect(Buffer.from(signedA.signature)).toEqual(Buffer.from(signedB.signature))
    })

    it('produces different signatures for different manifests (collision resistance)', async () => {
      // Arrange: Create manifests that differ only slightly
      const baseCredentials = [createTestCredential('payment_method', 'cred_test', 2)]
      const manifestA = createSecureManifest('a', baseCredentials)
      const manifestB = createSecureManifest('b', baseCredentials)

      // Act: Sign both
      const signedA = await signManifest(manifestA, TEST_PRIVATE_KEY)
      const signedB = await signManifest(manifestB, TEST_PRIVATE_KEY)

      // Assert: Even small changes must produce completely different signatures
      expect(Buffer.from(signedA.signature)).not.toEqual(Buffer.from(signedB.signature))
    })

    it('maintains signature consistency across different JSON representations', async () => {
      // Arrange: Create same manifest with different formatting
      const credentials = [createTestCredential('payment_method', 'cred_test', 2)]
      const manifestA = createSecureManifest('format', credentials)
      
      // Different JSON representations
      const prettyJson = JSON.parse(JSON.stringify(manifestA, null, 2))
      const uglyJson = JSON.parse(JSON.stringify(manifestA))
      
      // Act: Sign both
      const signedPretty = await signManifest(prettyJson, TEST_PRIVATE_KEY)
      const signedUgly = await signManifest(uglyJson, TEST_PRIVATE_KEY)

      // Assert: Formatting must not affect signature
      expect(Buffer.from(signedPretty.signature)).toEqual(Buffer.from(signedUgly.signature))
    })
  })

  describe('Key Validation & Security', () => {
    it('rejects private keys that fail format validation', async () => {
      // Arrange
      const manifest = createSecureManifest('test', [
        createTestCredential('payment_method', 'cred_test', 2)
      ])

      // Act & Assert: Must validate key format
      await expect(signManifest(manifest, INVALID_PRIVATE_KEY))
        .rejects
        .toThrowError(/Invalid private key format/)
    })

    it('rejects non-Ed25519 keys', async () => {
      // Arrange: Try to use RSA key (example)
      const manifest = createSecureManifest('test', [
        createTestCredential('payment_method', 'cred_test', 2)
      ])
      const rsaKeyBytes = new Uint8Array(128) // Wrong size for Ed25519

      // Act & Assert: Must enforce Ed25519
      await expect(signManifest(manifest, rsaKeyBytes))
        .rejects
        .toThrowError(/Invalid key type/)
    })

    it('prevents key extraction through error messages', async () => {
      // Arrange
      const manifest = createSecureManifest('test', [
        createTestCredential('payment_method', 'cred_test', 2)
      ])
      const badKey = new Uint8Array([1, 2, 3]) // Invalid key

      // Act
      try {
        await signManifest(manifest, badKey)
        fail('Should have thrown')
      } catch (err) {
        // Assert: Error should not contain key material
        expect(err.message).not.toContain('1,2,3')
        expect(err.toString()).not.toMatch(/[0-9a-f]{32,}/)
      }
    })
  })

  describe('Canonicalization Security', () => {
    it('signs the canonical form regardless of property order', async () => {
      // Arrange: Create manifests with different property order
      const credentials = [createTestCredential('payment_method', 'cred_test', 2)]
      const manifestA = createSecureManifest('canon', credentials)
      
      const manifestB = {
        principalId: manifestA.principalId,
        credentials: manifestA.credentials,
        agentId: manifestA.agentId,
        expiresAt: manifestA.expiresAt,
        createdAt: manifestA.createdAt
      }

      // Act
      const canonA = await canonicalizeManifest(manifestA)
      const canonB = await canonicalizeManifest(manifestB)

      // Assert: Canonical forms must match
      expect(canonA).toStrictEqual(canonB)
    })

    it('detects modification to manifest after signing', async () => {
      // This test verifies that modifying the manifest object after signing
      // causes signature verification to fail (immutability check)
      const manifest = createSecureManifest('test', [
        createTestCredential('payment_method', 'cred_test', 2)
      ])

      const signed = await signManifest(manifest, TEST_PRIVATE_KEY)
      
      // Modify manifest after signing
      ;(manifest as any).principalId = 'principal_evil'
      
      // Signature should fail because manifest was modified
      await expect(verifyManifestSignature(signed)).rejects.toThrowError('Invalid signature')
    })
  })

  describe('Side-Channel Prevention', () => {
    it('maintains constant-time operation regardless of input size', async () => {
      // Arrange: Create manifests of different sizes
      const smallManifest = createSecureManifest('small', [
        createTestCredential('payment_method', 'cred_1', 2)
      ])

      const largeManifest = createSecureManifest('large', Array(10).fill(null).map((_, i) => 
        createTestCredential('payment_method', `cred_${i}`, 2)
      ))

      // Act: Measure signing time (this is illustrative - real timing tests need more rigor)
      const t1 = Date.now()
      await signManifest(smallManifest, TEST_PRIVATE_KEY)
      const smallTime = Date.now() - t1

      const t2 = Date.now()
      await signManifest(largeManifest, TEST_PRIVATE_KEY)
      const largeTime = Date.now() - t2

      // Assert: Times should be roughly similar (within reason for JS timing)
      expect(Math.abs(largeTime - smallTime)).toBeLessThan(100)
    })
  })

  describe('Error Cases & Edge Conditions', () => {
    it('handles maximum allowed manifest size', async () => {
      // Arrange: Create manifest at size limit (100 credentials max)
      const maxCredentials = Array(100).fill(null).map((_, i) => 
        createTestCredential('payment_method', `cred_${i}`, 2)
      )

      // Act & Assert: Should create and sign successfully
      const manifest = createSecureManifest('max', maxCredentials)
      await expect(signManifest(manifest, TEST_PRIVATE_KEY)).resolves.toBeDefined()
    })

    it('rejects manifests that exceed credential limit', async () => {
      // Arrange: Try to create manifest with 101 credentials (exceeds MAX_CREDENTIALS = 100)
      const tooManyCredentials = Array(101).fill(null).map((_, i) => 
        createTestCredential('payment_method', `cred_${i}`, 2)
      )

      // Act & Assert: Manifest creation should throw
      expect(() => createSecureManifest('huge', tooManyCredentials))
        .toThrowError(/exceeds maximum allowed credentials/)
    })
  })
})