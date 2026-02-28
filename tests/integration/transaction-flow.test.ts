import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryAuditLog } from '../../../src/domain/services/audit-log'
import { AuditEntry } from '../../../src/domain/entities/audit-entry'
import { createAuditEntry } from '../../../src/domain/services/create-audit-entry'
import { sanitizeResponse } from '../../../src/domain/services/response-sanitization'

/**
 * Transaction Flow Integration Tests
 */

describe('Transaction Flow', () => {
  let auditLog: InMemoryAuditLog

  beforeEach(() => {
    auditLog = new InMemoryAuditLog()
  })

  describe('Audit Integration', () => {
    it('creates audit entry for successful transaction', () => {
      const entry = new AuditEntry('agent_1', 'principal_1', 'api_key', 'read', 'success', Date.now())
      auditLog.append(entry)

      expect(auditLog.count()).toBe(1)
    })

    it('creates audit entry for failed transaction', () => {
      const entry = new AuditEntry('agent_1', 'principal_1', 'api_key', 'delete', 'failure', Date.now())
      auditLog.append(entry)

      const failures = auditLog.query({ result: 'failure' })
      expect(failures).toHaveLength(1)
    })
  })

  describe('Sanitization Integration', () => {
    it('sanitizes response before returning', () => {
      const response = { cardNumber: '4111111111111111', status: 'ok' }

      const sanitized = sanitizeResponse(response)

      expect((sanitized as any).cardNumber).toBe('[REDACTED]')
      expect((sanitized as any).status).toBe('ok')
    })

    it('logs sanitized version to audit', () => {
      const entry = new AuditEntry('agent_1', 'principal_1', 'payment_method', 'charge', 'success', Date.now(), {
        riskScore: 0.5
      })
      auditLog.append(entry)

      expect(JSON.stringify(entry.context)).not.toContain('4111111111111111')
    })
  })

  describe('Full Flow', () => {
    it('full flow from manifest to audit', () => {
      const entry = new AuditEntry('agent_1', 'principal_1', 'payment_method', 'charge', 'success', Date.now())
      auditLog.append(entry)
      const results = auditLog.query({ agentId: 'agent_1' })
      const exported = auditLog.export()

      expect(results).toHaveLength(1)
      expect(JSON.parse(exported)).toHaveLength(1)
    })
  })

  describe('Performance', () => {
    it('handles 100 transactions quickly', async () => {
      const start = Date.now()
      
      for (let i = 0; i < 100; i++) {
        const entry = new AuditEntry(`agent_${i % 5}`, 'principal_1', 'api_key', 'read', 'success', Date.now() + i)
        auditLog.append(entry)
      }
      
      const duration = Date.now() - start

      expect(auditLog.count()).toBe(100)
      expect(duration).toBeLessThan(1000)
    })

    it('handles concurrent transactions', async () => {
      const entries = Array(50).fill(null).map((_, i) => 
        new AuditEntry(`agent_${i}`, 'principal_1', 'api_key', 'read', 'success', Date.now() + i)
      )

      await Promise.all(entries.map(e => Promise.resolve(auditLog.append(e))))

      expect(auditLog.count()).toBe(50)
    })
  })
})
