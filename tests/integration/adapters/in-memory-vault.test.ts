/**
 * InMemoryVault Integration Tests
 * 
 * Runs contract tests against InMemoryVault implementation.
 * Phase 1a: VaultAdapter port + InMemoryVault
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InMemoryVault } from '@/adapters/vault/in-memory-vault'
import type { VaultConfig, TransactionAction, ExecutionContext } from '@/ports/types'

const validInMemoryConfig: VaultConfig = {
  type: 'in-memory',
  credentials: {}
}

const validContext: ExecutionContext = {
  agentId: 'agent_001',
  principalId: 'principal_001',
  timestamp: Date.now()
}

const validPaymentAction: TransactionAction = {
  type: 'payment',
  params: { amount: 10.00 }
}

describe('VaultAdapter Contract: InMemoryVault', () => {
  let adapter: InMemoryVault

  beforeEach(() => {
    adapter = new InMemoryVault()
  })

  afterEach(async () => {
    try {
      await adapter.disconnect()
    } catch {}
  })

  describe('Identity', () => {
    it('exposes name as string', () => {
      expect(adapter.name).toBeTypeOf('string')
      expect(adapter.name.length).toBeGreaterThan(0)
    })

    it('exposes version as semver string', () => {
      expect(adapter.version).toMatch(/^\d+\.\d+\.\d+$/)
    })
  })

  describe('Lifecycle', () => {
    it('connects with valid config', async () => {
      await adapter.connect(validInMemoryConfig)
      const health = await adapter.health()
      expect(health.connected).toBe(true)
    })

    it('rejects invalid config', async () => {
      const invalidConfig = { type: '1password', credentials: {} }
      await expect(adapter.connect(invalidConfig)).rejects.toThrow()
    })

    it('disconnects cleanly', async () => {
      await adapter.connect(validInMemoryConfig)
      await adapter.disconnect()
      const health = await adapter.health()
      expect(health.connected).toBe(false)
    })

    it('reports health status', async () => {
      await adapter.connect(validInMemoryConfig)
      const health = await adapter.health()
      expect(health).toHaveProperty('connected')
      expect(health).toHaveProperty('lastCheck')
    })
  })

  describe('Credential Discovery', () => {
    beforeEach(async () => {
      await adapter.connect(validInMemoryConfig)
    })

    it('lists credentials for principal', async () => {
      const creds = await adapter.listCredentials('principal_001')
      expect(Array.isArray(creds)).toBe(true)
      expect(creds.length).toBeGreaterThan(0)
    })

    it('returns empty array for unknown principal', async () => {
      const creds = await adapter.listCredentials('unknown_principal')
      expect(creds).toEqual([])
    })

    it('returns credential metadata without values', async () => {
      const creds = await adapter.listCredentials('principal_001')
      creds.forEach(cred => {
        expect(cred).toHaveProperty('id')
        expect(cred).toHaveProperty('type')
        expect(cred).toHaveProperty('name')
        expect(cred).toHaveProperty('tier')
        expect(cred).not.toHaveProperty('value')
        expect(cred).not.toHaveProperty('secret')
      })
    })

    it('enforces tier boundaries (0-4)', async () => {
      const creds = await adapter.listCredentials('principal_001')
      creds.forEach(cred => {
        expect(cred.tier).toBeGreaterThanOrEqual(0)
        expect(cred.tier).toBeLessThanOrEqual(4)
      })
    })
  })

  describe('Transaction Execution', () => {
    beforeEach(async () => {
      await adapter.connect(validInMemoryConfig)
    })

    it('executes valid transaction', async () => {
      const result = await adapter.execute(
        'cred_payment_001',
        validPaymentAction,
        validContext
      )
      expect(result.success).toBe(true)
      expect(result.transactionId).toBeDefined()
      expect(result.timestamp).toBeDefined()
    })

    it('rejects unknown credential', async () => {
      await expect(adapter.execute(
        'unknown_cred',
        validPaymentAction,
        validContext
      )).rejects.toThrow('Credential not found')
    })

    it('rejects unknown principal', async () => {
      const unknownContext = { ...validContext, principalId: 'unknown_principal' }
      await expect(adapter.execute(
        'cred_payment_001',
        validPaymentAction,
        unknownContext
      )).rejects.toThrow('Unauthorized')
    })

    it('sanitizes result (removes credential fragments)', async () => {
      const result = await adapter.execute(
        'cred_payment_001',
        validPaymentAction,
        validContext
      )
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toMatch(/secret|key|password|token/i)
    })

    it('returns transaction ID for audit', async () => {
      const result = await adapter.execute(
        'cred_payment_001',
        validPaymentAction,
        validContext
      )
      expect(result.transactionId).toMatch(/^txn_/)
    })
  })

  describe('Security', () => {
    beforeEach(async () => {
      await adapter.connect(validInMemoryConfig)
    })

    it('never exposes credential values in errors', async () => {
      try {
        await adapter.execute('unknown_cred', validPaymentAction, validContext)
      } catch (err: any) {
        expect(err.message).not.toContain('secret')
        expect(err.message).not.toContain('key')
        expect(err.message).not.toMatch(/\d{16}/)
      }
    })

    it('validates principal owns credential', async () => {
      const unknownContext = { ...validContext, principalId: 'unknown_principal' }
      await expect(adapter.execute(
        'cred_payment_001',
        validPaymentAction,
        unknownContext
      )).rejects.toThrow('Unauthorized')
    })

    it('validates timestamp is recent', async () => {
      const oldContext = { ...validContext, timestamp: Date.now() - 3600000 }
      await expect(adapter.execute(
        'cred_payment_001',
        validPaymentAction,
        oldContext
      )).rejects.toThrow()
    })

    it('handles execution errors gracefully', async () => {
      const invalidAction: TransactionAction = {
        type: 'payment',
        params: { amount: -1 }
      }
      const result = await adapter.execute(
        'cred_payment_001',
        invalidAction,
        validContext
      )
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('InMemoryVault Specific', () => {
    it('provides getTransactions() for testing', async () => {
      await adapter.connect(validInMemoryConfig)
      await adapter.execute('cred_payment_001', validPaymentAction, validContext)
      
      const transactions = adapter.getTransactions()
      expect(transactions.length).toBeGreaterThan(0)
      expect(transactions[0].credentialId).toBe('cred_payment_001')
    })

    it('clears transactions on disconnect', async () => {
      await adapter.connect(validInMemoryConfig)
      await adapter.execute('cred_payment_001', validPaymentAction, validContext)
      
      await adapter.disconnect()
      
      const transactions = adapter.getTransactions()
      expect(transactions.length).toBe(0)
    })
  })
})
