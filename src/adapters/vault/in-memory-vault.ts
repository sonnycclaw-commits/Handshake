import type {
  CredentialMetadata,
  ExecutionContext,
  HealthStatus,
  TransactionAction,
  TransactionResult,
  VaultAdapter,
  VaultConfig
} from '../../ports/types'

type RecordedTransaction = {
  transactionId: string
  credentialId: string
  principalId: string
  agentId: string
  actionType: string
  timestamp: number
  success: boolean
}

const PRINCIPAL_CREDENTIALS: Record<string, CredentialMetadata[]> = {
  principal_001: [
    { id: 'cred_payment_001', type: 'payment_method', name: 'Visa ending 4567', tier: 2, lastUsed: Date.now() },
    { id: 'cred_api_001', type: 'api_key', name: 'OpenAI API Key', tier: 1, lastUsed: Date.now() },
    { id: 'cred_identity_001', type: 'identity_document', name: 'Passport', tier: 3, lastUsed: Date.now() },
    { id: 'cred_admin_001', type: 'admin', name: 'Admin Credentials', tier: 4, lastUsed: Date.now() }
  ]
}

const SAFE_ERROR = {
  INVALID_CREDENTIAL: 'INVALID_CREDENTIAL',
  UNAUTHORIZED: 'UNAUTHORIZED',
  STALE_CONTEXT: 'STALE_CONTEXT',
  INVALID_ACTION: 'INVALID_ACTION',
  INVALID_CONFIG: 'INVALID_CONFIG'
} as const

function vaultError(code: string, message: string): Error {
  const err = new Error(message)
  ;(err as any).code = code
  return err
}

export class InMemoryVault implements VaultAdapter {
  readonly name = 'in-memory-vault'
  readonly version = '1.0.0'

  private connected = false
  private lastCheck = Date.now()
  private readonly transactions: RecordedTransaction[] = []

  async connect(config: VaultConfig): Promise<void> {
    if (config.type !== 'in-memory') {
      throw vaultError(SAFE_ERROR.INVALID_CONFIG, 'Invalid vault config for InMemoryVault')
    }

    // idempotent connect - keep existing in-memory state
    this.connected = true
    this.lastCheck = Date.now()
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.lastCheck = Date.now()
    this.transactions.length = 0
  }

  async health(): Promise<HealthStatus> {
    this.lastCheck = Date.now()
    return { connected: this.connected, lastCheck: this.lastCheck }
  }

  async listCredentials(principalId: string): Promise<CredentialMetadata[]> {
    this.ensureConnected()
    const credentials = PRINCIPAL_CREDENTIALS[principalId] ?? []
    return credentials.map((c) => ({ ...c }))
  }

  async execute(
    credentialId: string,
    action: TransactionAction,
    context: ExecutionContext
  ): Promise<TransactionResult> {
    this.ensureConnected()

    const now = Date.now()
    if (now - context.timestamp > 5 * 60 * 1000 || context.timestamp - now > 2 * 60 * 1000) {
      throw vaultError(SAFE_ERROR.STALE_CONTEXT, 'Execution context timestamp is stale')
    }

    const principalCreds = PRINCIPAL_CREDENTIALS[context.principalId]
    if (!principalCreds) {
      throw vaultError(SAFE_ERROR.UNAUTHORIZED, 'Unauthorized')
    }

    const credential = principalCreds.find((c) => c.id === credentialId)
    if (!credential) {
      throw vaultError(SAFE_ERROR.INVALID_CREDENTIAL, 'Credential not found')
    }

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const timestamp = Date.now()

    // Simulate validation failures as non-throwing execution failures
    if (action.type === 'payment') {
      const amount = Number((action.params as any).amount)
      if (!Number.isFinite(amount) || amount < 0) {
        const failed: TransactionResult = {
          success: false,
          transactionId,
          timestamp,
          error: SAFE_ERROR.INVALID_ACTION
        }

        this.transactions.push({
          transactionId,
          credentialId,
          principalId: context.principalId,
          agentId: context.agentId,
          actionType: action.type,
          timestamp,
          success: false
        })

        return failed
      }
    }

    const result: TransactionResult = {
      success: true,
      transactionId,
      timestamp,
      details: {
        action: action.type,
        credential_type: credential.type,
        tier: credential.tier
      }
    }

    this.transactions.push({
      transactionId,
      credentialId,
      principalId: context.principalId,
      agentId: context.agentId,
      actionType: action.type,
      timestamp,
      success: true
    })

    return result
  }

  getTransactions(): RecordedTransaction[] {
    return this.transactions.map((t) => ({ ...t }))
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw vaultError(SAFE_ERROR.UNAUTHORIZED, 'Vault not connected')
    }
  }
}
