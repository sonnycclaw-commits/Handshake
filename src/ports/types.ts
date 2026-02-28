export type VaultType = 'in-memory' | 'env' | '1password' | 'aws-secrets-manager' | 'hashicorp-vault'

export interface VaultConfig {
  type: VaultType
  credentials: Record<string, unknown>
}

export interface HealthStatus {
  connected: boolean
  lastCheck: number
}

export interface CredentialMetadata {
  id: string
  type: string
  name: string
  tier: number
  lastUsed?: number
}

export interface TransactionAction {
  type: string
  params: Record<string, unknown>
}

export interface ExecutionContext {
  agentId: string
  principalId: string
  timestamp: number
}

export interface TransactionResult {
  success: boolean
  transactionId: string
  timestamp: number
  details?: Record<string, unknown>
  error?: string
}

export interface VaultAdapter {
  readonly name: string
  readonly version: string
  connect(config: VaultConfig): Promise<void>
  disconnect(): Promise<void>
  health(): Promise<HealthStatus>
  listCredentials(principalId: string): Promise<CredentialMetadata[]>
  execute(
    credentialId: string,
    action: TransactionAction,
    context: ExecutionContext
  ): Promise<TransactionResult>
}
