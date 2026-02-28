import { describe, it, expect } from 'vitest'
import { createManifest } from '@/domain/services/create-manifest'
import { signManifest } from '@/domain/services/sign-manifest'
import { verifyManifestSignature } from '@/domain/services/verify-manifest-signature'
import { generateKeyPair } from '@/domain/services/generate-key-pair'

/**
 * Stress Test Suite
 * 
 * Tests system behavior under load and edge conditions.
 * Phase 0 verification before proceeding to Phase 1.
 */

describe('Stress Tests', () => {
  describe('Credential Count Limits', () => {
    it('handles 100 credentials (maximum)', () => {
      const credentials = Array(100).fill(null).map((_, i) => ({
        type: 'payment_method',
        id: `cred_${i}`,
        tier: 2
      }))

      const start = Date.now()
      const manifest = createManifest({
        agentId: 'agent_stress',
        principalId: 'principal_stress',
        credentials,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        version: '1.0'
      })
      const duration = Date.now() - start

      expect(manifest.credentials).toHaveLength(100)
      expect(duration).toBeLessThan(100) // Should be fast
    })

    it('rejects 101 credentials (exceeds limit)', () => {
      const credentials = Array(101).fill(null).map((_, i) => ({
        type: 'payment_method',
        id: `cred_${i}`,
        tier: 2
      }))

      expect(() => createManifest({
        agentId: 'agent_stress',
        principalId: 'principal_stress',
        credentials,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        version: '1.0'
      })).toThrow()
    })
  })

  describe('Signature Throughput', () => {
    it('signs 50 manifests in under 5 seconds', async () => {
      const { privateKey } = await generateKeyPair()
      const manifests = Array(50).fill(null).map((_, i) => 
        createManifest({
          agentId: `agent_${i}`,
          principalId: 'principal_stress',
          credentials: [{ type: 'payment_method', id: `cred_${i}`, tier: 2 }],
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000,
          version: '1.0'
        })
      )

      const start = Date.now()
      const signed = await Promise.all(
        manifests.map(m => signManifest(m, privateKey))
      )
      const duration = Date.now() - start

      expect(signed).toHaveLength(50)
      expect(duration).toBeLessThan(5000)
    })

    it('verifies 50 signed manifests in under 5 seconds', async () => {
      const { privateKey } = await generateKeyPair()
      const manifests = Array(50).fill(null).map((_, i) => 
        createManifest({
          agentId: `agent_${i}`,
          principalId: 'principal_stress',
          credentials: [{ type: 'payment_method', id: `cred_${i}`, tier: 2 }],
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000,
          version: '1.0'
        })
      )

      const signed = await Promise.all(
        manifests.map(m => signManifest(m, privateKey))
      )

      const start = Date.now()
      const results = await Promise.all(
        signed.map(s => verifyManifestSignature(s))
      )
      const duration = Date.now() - start

      expect(results.every(r => r === true)).toBe(true)
      expect(duration).toBeLessThan(5000)
    })
  })

  describe('Memory Efficiency', () => {
    it('does not leak memory on repeated operations', async () => {
      const { privateKey } = await generateKeyPair()
      const initialMemory = process.memoryUsage().heapUsed

      // Sign and verify 100 times
      for (let i = 0; i < 100; i++) {
        const manifest = createManifest({
          agentId: `agent_${i}`,
          principalId: 'principal_stress',
          credentials: [{ type: 'payment_method', id: `cred_${i}`, tier: 2 }],
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000,
          version: '1.0'
        })
        const signed = await signManifest(manifest, privateKey)
        await verifyManifestSignature(signed)
      }

      const finalMemory = process.memoryUsage().heapUsed
      const growth = finalMemory - initialMemory

      // Memory growth should be reasonable (< 10MB for 100 iterations)
      expect(growth).toBeLessThan(10 * 1024 * 1024)
    })
  })

  describe('Edge Cases', () => {
    it('handles minimum valid manifest', async () => {
      const { privateKey } = await generateKeyPair()
      
      const manifest = createManifest({
        agentId: 'a',
        principalId: 'b',
        credentials: [{ type: 'payment_method', id: 'cred_min', tier: 0 }],
        createdAt: Date.now(),
        expiresAt: Date.now() + 1000, // Minimum 1 second
        version: '1.0'
      })

      const signed = await signManifest(manifest, privateKey)
      const verified = await verifyManifestSignature(signed)

      expect(verified).toBe(true)
    })

    it('handles long identifiers', () => {
      const longId = 'a'.repeat(256)
      
      const manifest = createManifest({
        agentId: longId,
        principalId: longId,
        credentials: [{ type: 'payment_method', id: 'cred_long', tier: 0 }],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        version: '1.0'
      })

      expect(manifest.agentId).toBe(longId)
      expect(manifest.principalId).toBe(longId)
    })

    it('handles mixed tier credentials', async () => {
      const { privateKey } = await generateKeyPair()
      
      const manifest = createManifest({
        agentId: 'agent_mixed',
        principalId: 'principal_mixed',
        credentials: [
          { type: 'payment_method', id: 'cred_0', tier: 0 },
          { type: 'payment_method', id: 'cred_1', tier: 1 },
          { type: 'payment_method', id: 'cred_2', tier: 2 },
          { type: 'payment_method', id: 'cred_3', tier: 3 },
          { type: 'payment_method', id: 'cred_4', tier: 4 }
        ],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        version: '1.0'
      })

      const signed = await signManifest(manifest, privateKey)
      const verified = await verifyManifestSignature(signed)

      expect(verified).toBe(true)
      expect(manifest.credentials).toHaveLength(5)
    })
  })

  describe('Concurrent Operations', () => {
    it('handles concurrent signing with different keys', async () => {
      const keys = await Promise.all([
        generateKeyPair(),
        generateKeyPair(),
        generateKeyPair()
      ])

      const manifests = keys.map((_, i) => 
        createManifest({
          agentId: `agent_${i}`,
          principalId: 'principal_concurrent',
          credentials: [{ type: 'payment_method', id: `cred_${i}`, tier: 2 }],
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000,
          version: '1.0'
        })
      )

      const signed = await Promise.all(
        manifests.map((m, i) => signManifest(m, keys[i].privateKey))
      )

      // Each should verify with its own key
      for (let i = 0; i < signed.length; i++) {
        const verified = await verifyManifestSignature(signed[i])
        expect(verified).toBe(true)
      }
    })
  })

  describe('Timestamp Edge Cases', () => {
    it('handles manifests at minimum expiry window (1 second)', () => {
      const now = Date.now()
      
      const manifest = createManifest({
        agentId: 'agent_min_expiry',
        principalId: 'principal_min_expiry',
        credentials: [{ type: 'payment_method', id: 'cred_min', tier: 0 }],
        createdAt: now,
        expiresAt: now + 1000, // Exactly 1 second
        version: '1.0'
      })

      expect(manifest.expiresAt - manifest.createdAt).toBe(1000)
    })

    it('rejects manifests below minimum expiry window', () => {
      const now = Date.now()
      
      expect(() => createManifest({
        agentId: 'agent_invalid_expiry',
        principalId: 'principal_invalid_expiry',
        credentials: [{ type: 'payment_method', id: 'cred_invalid', tier: 0 }],
        createdAt: now,
        expiresAt: now + 999, // Below 1 second
        version: '1.0'
      })).toThrow()
    })
  })
})
