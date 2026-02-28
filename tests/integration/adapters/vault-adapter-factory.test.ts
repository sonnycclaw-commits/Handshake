import { describe, it, expect } from 'vitest'
import { createVaultAdapter } from '@/adapters/vault'

describe('Vault Adapter Factory', () => {
  it('creates in-memory adapter for in-memory config', () => {
    const adapter = createVaultAdapter({ type: 'in-memory', credentials: {} })
    expect(adapter.name).toBe('in-memory-vault')
  })

  it('creates env adapter for env config', () => {
    const adapter = createVaultAdapter({ type: 'env', credentials: { prefix: 'HANDSHAKE_VAULT_' } })
    expect(adapter.name).toBe('env-vault')
  })

  it('rejects unsupported adapter type', () => {
    expect(() => createVaultAdapter({ type: '1password', credentials: {} })).toThrow('INVALID_CONFIG')
  })
})
