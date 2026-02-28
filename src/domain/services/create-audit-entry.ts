import { AuditEntry, type AuditEntryContext } from '../entities/audit-entry'

/**
 * TransactionResult
 * 
 * Input to createAuditEntry factory.
 */
export interface TransactionResult {
  agentId: string
  principalId: string
  credentialType: string
  action: string
  result: 'success' | 'failure' | 'denied'
  timestamp?: number
  context?: {
    riskScore?: number
    guardrails?: string[]
    guardrailsTriggered?: string[]
    [key: string]: unknown
  }
}

/**
 * Card number pattern: 13-19 consecutive digits
 */
const CARD_PATTERN = /\d{13,19}/

/**
 * Check if a string contains a card number.
 */
function containsCardNumber(value: string): boolean {
  // Remove common separators
  const cleaned = value.replace(/[\s\-\.]/g, '')
  return CARD_PATTERN.test(cleaned)
}

/**
 * Check if a key name suggests a credential fragment.
 */
function isCredentialFragmentKey(key: string): boolean {
  const lower = key.toLowerCase()
  return lower.includes('card') || lower.includes('last')
}

/**
 * Check if a value looks like a credential fragment (4 digits).
 */
function isCredentialFragment(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return /^\d{4}$/.test(value.trim())
}

/**
 * Recursively check context for credentials.
 */
function contextContainsCredential(obj: unknown, depth = 0): boolean {
  // Prevent infinite recursion
  if (depth > 100) return false
  
  if (typeof obj === 'string') {
    return containsCardNumber(obj)
  }
  
  if (typeof obj !== 'object' || obj === null) {
    return false
  }
  
  // Check array elements
  if (Array.isArray(obj)) {
    return obj.some(item => contextContainsCredential(item, depth + 1))
  }
  
  // Check object properties
  for (const [key, value] of Object.entries(obj)) {
    // Check key-based fragment detection
    if (isCredentialFragmentKey(key) && isCredentialFragment(value)) {
      return true
    }
    
    // Check value for card numbers
    if (typeof value === 'string' && containsCardNumber(value)) {
      return true
    }
    
    // Recurse into nested objects
    if (typeof value === 'object' && value !== null) {
      if (contextContainsCredential(value, depth + 1)) {
        return true
      }
    }
  }
  
  return false
}

/**
 * createAuditEntry
 * 
 * Factory function to create audit entries with validation.
 * Throws if:
 * - agentId is missing
 * - timestamp is > 60s in the past
 * - timestamp is > 5s in the future
 * - context contains credential values
 */
export function createAuditEntry(tx: TransactionResult): AuditEntry {
  // Validate required fields
  if (!tx.agentId) {
    throw new Error('agentId is required')
  }
  
  // Check for credentials in context
  if (tx.context && contextContainsCredential(tx.context)) {
    throw new Error('Audit entry cannot contain credential values')
  }
  
  // Handle timestamp
  const now = Date.now()
  const timestamp = tx.timestamp ?? now
  
  // Validate timestamp
  if (timestamp < now - 60000) {
    throw new Error('Entry timestamp cannot be in the past')
  }
  if (timestamp > now + 5000) {
    throw new Error('Entry timestamp cannot be in the future')
  }
  
  // Build context
  let context: AuditEntryContext | undefined
  if (tx.context) {
    context = {
      riskScore: tx.context.riskScore,
      guardrails: tx.context.guardrails ?? tx.context.guardrailsTriggered
    }
  }
  
  return new AuditEntry(
    tx.agentId,
    tx.principalId,
    tx.credentialType,
    tx.action,
    tx.result,
    timestamp,
    context
  )
}