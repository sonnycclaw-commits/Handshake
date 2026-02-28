/**
 * Test Fixtures for VaultAdapter Tests
 * 
 * Provides consistent test data across all vault adapter tests.
 */

import type {
  VaultConfig,
  CredentialMetadata,
  TransactionAction,
  ExecutionContext
} from '@/ports/types'

// ============================================================
// VALID CONFIGS
// ============================================================

export const validInMemoryConfig: VaultConfig = {
  type: 'in-memory',
  credentials: {}
}

export const invalidConfig: VaultConfig = {
  type: '1password',  // Wrong type for InMemoryVault
  credentials: {}
}

// ============================================================
// TEST CREDENTIALS
// ============================================================

export const testCredentialPayment: CredentialMetadata = {
  id: 'cred_payment_001',
  type: 'payment_method',
  name: 'Visa ending 4567',
  tier: 2,
  lastUsed: Date.now()
}

export const testCredentialAPI: CredentialMetadata = {
  id: 'cred_api_001',
  type: 'api_key',
  name: 'OpenAI API Key',
  tier: 1,
  lastUsed: Date.now()
}

export const testCredentialIdentity: CredentialMetadata = {
  id: 'cred_identity_001',
  type: 'identity_document',
  name: 'Passport',
  tier: 3,
  lastUsed: Date.now()
}

export const testCredentialAdmin: CredentialMetadata = {
  id: 'cred_admin_001',
  type: 'admin',
  name: 'Admin Credentials',
  tier: 4,
  lastUsed: Date.now()
}

export const allTestCredentials: CredentialMetadata[] = [
  testCredentialPayment,
  testCredentialAPI,
  testCredentialIdentity,
  testCredentialAdmin
]

// ============================================================
// TEST ACTIONS
// ============================================================

export const validPaymentAction: TransactionAction = {
  type: 'payment',
  params: { amount: 10.00, currency: 'USD' }
}

export const validAPIAction: TransactionAction = {
  type: 'api_call',
  params: { endpoint: '/v1/chat/completions', method: 'POST' }
}

export const invalidAction: TransactionAction = {
  type: 'payment',
  params: { amount: -1 }  // Invalid amount
}

// ============================================================
// TEST CONTEXTS
// ============================================================

export const validContext: ExecutionContext = {
  agentId: 'agent_001',
  principalId: 'principal_001',
  timestamp: Date.now()
}

export const unknownPrincipalContext: ExecutionContext = {
  agentId: 'agent_001',
  principalId: 'unknown_principal',
  timestamp: Date.now()
}

export const oldTimestampContext: ExecutionContext = {
  agentId: 'agent_001',
  principalId: 'principal_001',
  timestamp: Date.now() - 3600000  // 1 hour ago
}

// ============================================================
// PRINCIPAL IDS
// ============================================================

export const PRINCIPAL_001 = 'principal_001'
export const PRINCIPAL_002 = 'principal_002'
export const UNKNOWN_PRINCIPAL = 'unknown_principal'

// ============================================================
// CREDENTIAL IDS
// ============================================================

export const CRED_PAYMENT_001 = 'cred_payment_001'
export const CRED_API_001 = 'cred_api_001'
export const CRED_IDENTITY_001 = 'cred_identity_001'
export const UNKNOWN_CRED = 'unknown_cred'
