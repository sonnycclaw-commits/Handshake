import type {
  CredentialMetadata,
  ExecutionContext,
  HealthStatus,
  TransactionAction,
  TransactionResult,
  VaultAdapter,
  VaultConfig
} from '../../ports/types'

type EnvCredential = CredentialMetadata & {
  principalId: string
}

const SAFE_ERROR = {
  CONFIG_ERROR: 'CONFIG_ERROR',
  MISSING_ENV: 'MISSING_ENV',
  INVALID_CONFIG: 'INVALID_CONFIG',
  INVALID_CREDENTIAL: 'INVALID_CREDENTIAL',
  UNAUTHORIZED: 'UNAUTHORIZED',
  STALE_CONTEXT: 'STALE_CONTEXT',
  INVALID_ACTION: 'INVALID_ACTION'
} as const

export class EnvVault implements VaultAdapter {
  readonly name = 'env-vault'
  readonly version = '1.0.0'

  private connected = false
  private lastCheck = Date.now()
  private prefix = 'HANDSHAKE_VAULT_'
  private credentials: EnvCredential[] = []

  async connect(config: VaultConfig): Promise<void> {
    if (config.type !== 'env') {
      throw new Error(SAFE_ERROR.INVALID_CONFIG)
    }

    const configuredPrefix = String(config.credentials?.prefix ?? this.prefix)
    if (!configuredPrefix || configuredPrefix.length < 3) {
      throw new Error(SAFE_ERROR.CONFIG_ERROR)
    }

    this.prefix = configuredPrefix

    const required = [`${this.prefix}CREDENTIALS_JSON`]
    const missing = required.filter(k => !process.env[k])
    if (missing.length > 0) {
      throw new Error(SAFE_ERROR.MISSING_ENV)
    }

    let parsed: any
    try {
      parsed = JSON.parse(String(process.env[`${this.prefix}CREDENTIALS_JSON`]))
    } catch {
      throw new Error(SAFE_ERROR.INVALID_CONFIG)
    }

    if (!Array.isArray(parsed)) throw new Error(SAFE_ERROR.INVALID_CONFIG)

    this.credentials = parsed
      .filter((x: any) => x && typeof x === 'object')
      .map((x: any) => ({
        id: String(x.id),
        type: String(x.type),
        name: String(x.name),
        tier: Number(x.tier),
        principalId: String(x.principalId),
        lastUsed: Number.isFinite(Number(x.lastUsed)) ? Number(x.lastUsed) : undefined
      }))
      .filter((x: EnvCredential) => x.id && x.type && x.name && Number.isFinite(x.tier) && x.principalId)

    this.connected = true
    this.lastCheck = Date.now()
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.lastCheck = Date.now()
    this.credentials = []
  }

  async health(): Promise<HealthStatus> {
    this.lastCheck = Date.now()
    return { connected: this.connected, lastCheck: this.lastCheck }
  }

  async listCredentials(principalId: string): Promise<CredentialMetadata[]> {
    this.ensureConnected()
    return this.credentials.filter(c => c.principalId === principalId).map(({ principalId: _principalId, ...meta }) => ({ ...meta }))
  }

  async execute(credentialId: string, action: TransactionAction, context: ExecutionContext): Promise<TransactionResult> {
    this.ensureConnected()

    const now = Date.now()
    if (now - context.timestamp > 5 * 60 * 1000 || context.timestamp - now > 2 * 60 * 1000) {
      throw new Error(SAFE_ERROR.STALE_CONTEXT)
    }

    const credential = this.credentials.find(c => c.id === credentialId)
    if (!credential) throw new Error(SAFE_ERROR.INVALID_CREDENTIAL)
    if (credential.principalId !== context.principalId) throw new Error(SAFE_ERROR.UNAUTHORIZED)

    if (action.type === 'payment') {
      const amount = Number((action.params as any).amount)
      if (!Number.isFinite(amount) || amount < 0) {
        return { success: false, transactionId: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now(), error: SAFE_ERROR.INVALID_ACTION }
      }
    }

    return {
      success: true,
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      details: { action: action.type, credential_type: credential.type, tier: credential.tier }
    }
  }

  private ensureConnected(): void {
    if (!this.connected) throw new Error(SAFE_ERROR.UNAUTHORIZED)
  }
}
