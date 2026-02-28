import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryVault } from '@/adapters/vault/in-memory-vault'
import { runVaultAdapterConformanceSuite } from '../../harness/vault-adapter-conformance'
import type { VaultConfig, ExecutionContext, TransactionAction } from '@/ports/types'

const validConfig: VaultConfig = { type: 'in-memory', credentials: {} }
const invalidConfig: VaultConfig = { type: '1password', credentials: {} }

const validContext: ExecutionContext = {
  agentId: 'agent_001',
  principalId: 'principal_001',
  timestamp: Date.now()
}

const validAction: TransactionAction = {
  type: 'payment',
  params: { amount: 10, currency: 'USD' }
}

runVaultAdapterConformanceSuite(
  'InMemoryVault',
  () => new InMemoryVault(),
  validConfig,
  invalidConfig,
  validContext,
  validAction
)

describe('Phase 2 Failure Modes: InMemoryVault (RED first)', () => {
  let vault: InMemoryVault

  beforeEach(async () => {
    vault = new InMemoryVault()
    await vault.connect(validConfig)
  })

  it('idempotent connect should not reset transaction history', async () => {
    await vault.execute('cred_payment_001', validAction, validContext)
    const before = vault.getTransactions().length

    await vault.connect(validConfig)

    const after = vault.getTransactions().length
    expect(after).toBe(before)
  })

  it('disconnect should be idempotent (safe to call twice)', async () => {
    await vault.disconnect()
    await expect(vault.disconnect()).resolves.toBeUndefined()
  })

  it('rejects far-future timestamps (clock abuse)', async () => {
    const futureContext: ExecutionContext = {
      ...validContext,
      timestamp: Date.now() + 10 * 60 * 1000
    }

    await expect(vault.execute('cred_payment_001', validAction, futureContext)).rejects.toThrow()
  })

  it('normalizes thrown errors to a safe bounded message/code set', async () => {
    const badContext: ExecutionContext = {
      ...validContext,
      principalId: 'unknown_principal'
    }

    try {
      await vault.execute('cred_payment_001', validAction, badContext)
      throw new Error('expected execution to throw')
    } catch (err: any) {
      const normalized = String(err?.code || err?.message || '')
      expect(['UNAUTHORIZED', 'INVALID_CREDENTIAL', 'STALE_CONTEXT', 'INVALID_ACTION']).toContain(normalized)
    }
  })
})
