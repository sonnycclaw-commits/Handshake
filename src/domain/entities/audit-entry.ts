import { createHash, randomUUID } from 'crypto'

/**
 * AuditEntry Entity
 * 
 * Immutable audit entry with hash chain support.
 * Core purpose: Prove what happened without exposing what was accessed.
 */

export interface AuditEntryContext {
  riskScore?: number
  guardrails?: string[]
  metadata?: Record<string, unknown>
}

export class AuditEntry {
  readonly id: string
  readonly agentId: string
  readonly principalId: string
  readonly credentialType: string
  readonly action: string
  readonly result: 'success' | 'failure' | 'denied'
  readonly timestamp: number
  readonly context?: AuditEntryContext
  readonly previousHash?: string

  constructor(
    agentId: string,
    principalId: string,
    credentialType: string,
    action: string,
    result: 'success' | 'failure' | 'denied',
    timestamp: number,
    context?: AuditEntryContext,
    previousHash?: string
  ) {
    this.id = `audit_${randomUUID()}`
    this.agentId = agentId
    this.principalId = principalId
    this.credentialType = credentialType
    this.action = action
    this.result = result
    this.timestamp = timestamp
    this.previousHash = previousHash

    // Freeze context if provided
    if (context) {
      this.context = Object.freeze({ ...context })
      // Freeze nested arrays
      if (this.context.guardrails) {
        Object.freeze(this.context.guardrails)
      }
      if (this.context.metadata) {
        Object.freeze(this.context.metadata)
      }
    }

    // Freeze the entry itself
    Object.freeze(this)
  }

  computeHash(): string {
    const content = JSON.stringify({
      id: this.id,
      agentId: this.agentId,
      principalId: this.principalId,
      credentialType: this.credentialType,
      action: this.action,
      result: this.result,
      timestamp: this.timestamp,
      previousHash: this.previousHash
    })
    return createHash('sha256').update(content).digest('hex')
  }
}
