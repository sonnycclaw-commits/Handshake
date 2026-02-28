import type { VaultAdapter, VaultConfig } from '../../ports/types'
import { InMemoryVault } from './in-memory-vault'
import { EnvVault } from './env-vault'

export function createVaultAdapter(config: VaultConfig): VaultAdapter {
  if (config.type === 'in-memory') return new InMemoryVault()
  if (config.type === 'env') return new EnvVault()
  throw new Error('INVALID_CONFIG')
}
