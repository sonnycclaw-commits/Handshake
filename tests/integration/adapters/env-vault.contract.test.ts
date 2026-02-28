import { describe, beforeAll, afterAll, it, expect } from 'vitest'
import { runVaultAdapterConformanceSuite } from '../../harness/vault-adapter-conformance'
import type { VaultConfig, ExecutionContext, TransactionAction } from '@/ports/types'
import { EnvVault } from '@/adapters/vault/env-vault'

const ENV_KEY = 'HANDSHAKE_VAULT_CREDENTIALS_JSON'

const validConfig: VaultConfig = {
  type: 'env',
  credentials: {
    source: 'process-env',
    prefix: 'HANDSHAKE_VAULT_'
  }
}

const invalidConfig: VaultConfig = {
  type: 'aws-secrets-manager',
  credentials: {}
}

const validContext: ExecutionContext = {
  agentId: 'agent_001',
  principalId: 'principal_001',
  timestamp: Date.now()
}

const validAction: TransactionAction = {
  type: 'api_call',
  params: { endpoint: '/v1/payments', method: 'POST' }
}

describe('Phase 2 Contract: EnvVault', () => {
  const prev = process.env[ENV_KEY]

  beforeAll(() => {
    process.env[ENV_KEY] = JSON.stringify([
      { id: 'cred_env_001', type: 'api_key', name: 'Service API', tier: 1, principalId: 'principal_001' }
    ])
  })

  afterAll(() => {
    if (prev === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = prev
  })

  runVaultAdapterConformanceSuite(
    'EnvVault',
    () => new EnvVault(),
    validConfig,
    invalidConfig,
    validContext,
    validAction
  )

  it('fails fast when required env secrets are missing', async () => {
    const saved = process.env[ENV_KEY]
    delete process.env[ENV_KEY]

    const vault = new EnvVault()
    await expect(vault.connect(validConfig)).rejects.toThrow(/MISSING_ENV|CONFIG_ERROR|INVALID_CONFIG/)

    if (saved !== undefined) process.env[ENV_KEY] = saved
  })

  it('does not leak env key names or secret values in config errors', async () => {
    const saved = process.env[ENV_KEY]
    delete process.env[ENV_KEY]

    const vault = new EnvVault()
    try {
      await vault.connect(validConfig)
      throw new Error('expected connect to fail with missing env')
    } catch (err: any) {
      const msg = String(err?.message || '')
      expect(msg).not.toMatch(/HANDSHAKE_VAULT_|JWT_PRIVATE_KEY|JWT_PUBLIC_KEY|GOOGLE_CLIENT_SECRET|GITHUB_CLIENT_SECRET/)
    } finally {
      if (saved !== undefined) process.env[ENV_KEY] = saved
    }
  })
})
