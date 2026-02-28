import { describe, it, expect } from 'vitest'
import { EnvVault } from '../../../src/adapters/vault/env-vault'

describe('EnvVault Premortem Fixes', () => {
  it('accepts only env config type', async () => {
    const vault = new EnvVault()
    await expect(vault.connect({ type: 'in-memory', credentials: {} } as any)).rejects.toThrow('INVALID_CONFIG')
  })
})
