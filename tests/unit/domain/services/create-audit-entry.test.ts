import { describe, it, expect, beforeEach } from 'vitest'
import { createAuditEntry, type TransactionResult } from '@/domain/services/create-audit-entry'

/**
 * createAuditEntry Tests
 * 
 * What matters: Factory validates and sanitizes before creating entries.
 */

describe('createAuditEntry()', () => {
  describe('Entry Creation', () => {
    it('creates entry from transaction', () => {
      const entry = createAuditEntry({
        agentId: 'agent_1',
        principalId: 'principal_1',
        credentialType: 'api_key',
        action: 'read',
        result: 'success'
      })

      expect(entry.agentId).toBe('agent_1')
      expect(entry.action).toBe('read')
    })

    it('uses provided timestamp', () => {
      const timestamp = Date.now()
      const entry = createAuditEntry({
        agentId: 'agent_1',
        principalId: 'principal_1',
        credentialType: 'api_key',
        action: 'read',
        result: 'success',
        timestamp
      })

      expect(entry.timestamp).toBe(timestamp)
    })

    it('generates timestamp if missing', () => {
      const before = Date.now()
      const entry = createAuditEntry({
        agentId: 'agent_1',
        principalId: 'principal_1',
        credentialType: 'api_key',
        action: 'read',
        result: 'success'
      })
      const after = Date.now()

      expect(entry.timestamp).toBeGreaterThanOrEqual(before)
      expect(entry.timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('Context Extraction', () => {
    it('includes risk score', () => {
      const entry = createAuditEntry({
        agentId: 'agent_1',
        principalId: 'principal_1',
        credentialType: 'payment_method',
        action: 'charge',
        result: 'success',
        context: { riskScore: 0.75 }
      })

      expect(entry.context?.riskScore).toBe(0.75)
    })

    it('includes guardrails', () => {
      const entry = createAuditEntry({
        agentId: 'agent_1',
        principalId: 'principal_1',
        credentialType: 'payment_method',
        action: 'charge',
        result: 'success',
        context: { guardrailsTriggered: ['velocity', 'amount'] }
      })

      expect(entry.context?.guardrails).toContain('velocity')
    })
  })

  describe('Credential Rejection', () => {
    it('rejects credential value', () => {
      expect(() => createAuditEntry({
        agentId: 'agent_1',
        principalId: 'principal_1',
        credentialType: 'payment_method',
        action: 'charge',
        result: 'success',
        context: { cardNumber: '4111111111111111' }
      })).toThrowError('Audit entry cannot contain credential values')
    })

    it('rejects credential fragment', () => {
      expect(() => createAuditEntry({
        agentId: 'agent_1',
        principalId: 'principal_1',
        credentialType: 'payment_method',
        action: 'charge',
        result: 'success',
        context: { cardLastFour: '1111' }
      })).toThrowError('Audit entry cannot contain credential values')
    })
  })
})
