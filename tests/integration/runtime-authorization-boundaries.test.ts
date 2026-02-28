import { describe, it, expect } from 'vitest'
import { InMemoryVault } from '../../src/adapters/vault/in-memory-vault'

describe('Runtime Authorization Boundaries', () => {
  it('rejects credential ownership mismatch', async () => {
    const vault = new InMemoryVault()
    await vault.connect({ type: 'in-memory', credentials: {} })

    await expect(
      vault.execute(
        'cred_payment_001',
        { type: 'payment', params: { amount: 10 } },
        { agentId: 'agent_001', principalId: 'principal_999', timestamp: Date.now() }
      )
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects unknown credential reference', async () => {
    const vault = new InMemoryVault()
    await vault.connect({ type: 'in-memory', credentials: {} })

    await expect(
      vault.execute(
        'cred_unknown_001',
        { type: 'payment', params: { amount: 10 } },
        { agentId: 'agent_001', principalId: 'principal_001', timestamp: Date.now() }
      )
    ).rejects.toThrow('Credential not found')
  })

  it('rejects execution when adapter is not connected', async () => {
    const vault = new InMemoryVault()

    await expect(
      vault.execute(
        'cred_payment_001',
        { type: 'payment', params: { amount: 10 } },
        { agentId: 'agent_001', principalId: 'principal_001', timestamp: Date.now() }
      )
    ).rejects.toThrow('Vault not connected')
  })
})
