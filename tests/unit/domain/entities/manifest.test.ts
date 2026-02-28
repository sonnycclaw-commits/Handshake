import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Manifest } from '../../../../src/domain/entities/manifest'
import { CredentialType } from '../../../../src/domain/value-objects/credential-type'
import { CredentialId } from '../../../../src/domain/value-objects/credential-id'
import { Tier } from '../../../../src/domain/value-objects/tier'

/**
 * Test Fixtures
 * These represent real-world credential types with clear intent.
 * Each fixture maps to a specific security tier per D002.
 */
const fixtures = {
  // Tier 0: Auto-approved read operations
  readOnlyCredential: {
    type: CredentialType.from('read_only'),
    id: CredentialId.from('cred_readonly_123'),
    tier: Tier.from(0)
  },

  // Tier 1: Low-risk writes (e.g., weather API key)
  lowRiskCredential: {
    type: CredentialType.from('weather_api'),
    id: CredentialId.from('cred_weather_456'),
    tier: Tier.from(1)
  },

  // Tier 2: Medium risk ($10-50 payments)
  paymentCredential: {
    type: CredentialType.from('payment_method'),
    id: CredentialId.from('cred_payment_789'),
    tier: Tier.from(2)
  },

  // Tier 3: High risk (identity documents)
  identityCredential: {
    type: CredentialType.from('identity_document'),
    id: CredentialId.from('cred_identity_012'),
    tier: Tier.from(3)
  }
}

describe('Manifest Entity', () => {
  // Reset timers between tests
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Manifest Creation & Validation', () => {
    it('creates a valid manifest with required security properties', () => {
      // Arrange: Set up a manifest that meets all security requirements
      const now = Date.now()
      const validManifest = new Manifest(
        'agent_123',
        'principal_456',
        [fixtures.readOnlyCredential],
        now,
        now + 3600000 // 1 hour expiry
      )

      // Assert: Security properties are enforced
      expect(validManifest.agentId).toMatch(/^agent_[a-zA-Z0-9]+$/) // Format validation
      expect(validManifest.principalId).toMatch(/^principal_[a-zA-Z0-9]+$/)
      expect(validManifest.createdAt).toBeLessThan(validManifest.expiresAt)
      expect(validManifest.credentials).toHaveLength(1)
      expect(validManifest.credentials[0].tier.level).toBe(0) // Tier enforcement
    })

    it('prevents manifest creation with expired timestamps', () => {
      // Arrange: Attempt to create a manifest that's already expired
      const now = Date.now()
      
      // Act & Assert: Should throw with security-focused message
      expect(() => new Manifest(
        'agent_123',
        'principal_456',
        [fixtures.readOnlyCredential],
        now,
        now - 1 // Expired
      )).toThrowError('Invalid manifest timestamps: manifest cannot be created with past expiry')
    })

    it('enforces minimum expiry window to prevent time-of-check/time-of-use attacks', () => {
      // Arrange: Try to create a manifest with too short expiry
      const now = Date.now()
      
      // Act & Assert: Should enforce minimum window
      expect(() => new Manifest(
        'agent_123',
        'principal_456',
        [fixtures.readOnlyCredential],
        now,
        now + 999 // Less than minimum
      )).toThrowError('Manifest expiry window must be at least 1 second')
    })
  })

  describe('Credential Security Properties', () => {
    it('enforces credential tier isolation', () => {
      // Arrange: Create manifest with mixed-tier credentials
      const now = Date.now()
      const manifest = new Manifest(
        'agent_123',
        'principal_456',
        [
          fixtures.readOnlyCredential,    // Tier 0
          fixtures.paymentCredential      // Tier 2
        ],
        now,
        now + 3600000
      )

      // Act & Assert: Verify tier separation
      const hasReadOnly = manifest.hasCredential(fixtures.readOnlyCredential.type)
      const hasPayment = manifest.hasCredential(fixtures.paymentCredential.type)
      
      expect(hasReadOnly).toBe(true)
      expect(hasPayment).toBe(true)
      expect(manifest.getCredentialsByTier(0)).toHaveLength(1)
      expect(manifest.getCredentialsByTier(2)).toHaveLength(1)
    })

    it('prevents credential type forgery through value object equality', () => {
      // Arrange: Attempt credential type forgery
      const storedType = CredentialType.from('payment_method')
      const forgedType = { toString: () => 'payment_method', value: 'payment_method' } // Forge attempt
      
      const manifest = new Manifest(
        'agent_123',
        'principal_456',
        [fixtures.paymentCredential],
        Date.now(),
        Date.now() + 3600000
      )

      // Act: Try to match with forged type
      const result = manifest.hasCredential(storedType)
      
      // Assert: Only true CredentialType instances work
      expect(result).toBe(true)
      expect(manifest.hasCredential(forgedType as any)).toBe(false)
    })

    it('allows multiple credentials of same type if explicitly permitted', () => {
      // Arrange: Multiple payment methods (common case)
      const now = Date.now()
      const manifest = new Manifest(
        'agent_123',
        'principal_456',
        [
          fixtures.paymentCredential,
          { ...fixtures.paymentCredential, id: CredentialId.from('cred_payment_alternative') }
        ],
        now,
        now + 3600000
      )

      // Act: Get all payment credentials
      const paymentCredentials = manifest.getCredentialsByType(CredentialType.from('payment_method'))

      // Assert: Multiple allowed, but properly tracked
      expect(paymentCredentials).toHaveLength(2)
      expect(new Set(paymentCredentials.map(c => c.id.value)).size).toBe(2) // Unique IDs
    })
  })

  describe('Temporal Security Properties', () => {
    it('detects manifest expiry with millisecond precision', () => {
      // Arrange: Create manifest with 2 second expiry (minimum is 1 second)
      const now = Date.now()
      const manifest = new Manifest(
        'agent_123',
        'principal_456',
        [fixtures.readOnlyCredential],
        now,
        now + 2000 // 2 seconds
      )

      // Assert: Not expired immediately
      expect(manifest.isExpired()).toBe(false)
      
      // Test with explicit reference time (millisecond precision)
      expect(manifest.isExpired(now + 1999)).toBe(false)
      expect(manifest.isExpired(now + 2000)).toBe(false)
      expect(manifest.isExpired(now + 2001)).toBe(true)
    })

    it('handles timezone-independent timestamp comparison', () => {
      // Arrange: Create manifest with UTC timestamps
      const utcNow = new Date().getTime()
      const manifest = new Manifest(
        'agent_123',
        'principal_456',
        [fixtures.readOnlyCredential],
        utcNow,
        utcNow + 3600000
      )

      // Assert: Timestamp handling is timezone-independent
      expect(manifest.createdAt).toBe(utcNow)
      expect(manifest.expiresAt).toBe(utcNow + 3600000)
      expect(manifest.isExpired()).toBe(false)
    })
  })

  describe('Edge Cases & Error Handling', () => {
    it('rejects manifests with no credentials', () => {
      expect(() => new Manifest(
        'agent_123',
        'principal_456',
        [], // Empty credentials
        Date.now(),
        Date.now() + 3600000
      )).toThrowError('Manifest must contain at least one credential')
    })

    it('handles maximum allowed credentials', () => {
      // Arrange: Create manifest with maximum allowed credentials
      const MAX_CREDENTIALS = 100 // Example limit
      const manyCredentials = Array(MAX_CREDENTIALS + 1).fill(fixtures.readOnlyCredential)

      // Act & Assert: Should throw on exceeding limit
      expect(() => new Manifest(
        'agent_123',
        'principal_456',
        manyCredentials,
        Date.now(),
        Date.now() + 3600000
      )).toThrowError('Manifest exceeds maximum allowed credentials')
    })

    it('validates credential ID format', () => {
      expect(() => new Manifest(
        'agent_123',
        'principal_456',
        [{
          ...fixtures.readOnlyCredential,
          id: CredentialId.from('invalid-format') // Invalid format
        }],
        Date.now(),
        Date.now() + 3600000
      )).toThrowError('Invalid credential ID format')
    })
  })
})