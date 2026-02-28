import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuditEntry } from '@/domain/entities/audit-entry'
import { createAuditEntry } from '@/domain/services/create-audit-entry'
import { InMemoryAuditLog } from '@/domain/services/audit-log'

/**
 * Audit Integrity Tests
 * 
 * What matters: Audit entries can't be forged, modified, or backdated.
 */

describe('Audit Integrity', () => {
  let auditLog: InMemoryAuditLog

  beforeEach(() => {
    auditLog = new InMemoryAuditLog()
    vi.useRealTimers()
  })

  describe('Tamper Prevention', () => {
    it('prevents modification of audit entries', () => {
      const entry = new AuditEntry('agent_1', 'principal_1', 'api_key', 'read', 'success', Date.now())

      expect(() => {
        (entry as any).agentId = 'compromised'
      }).toThrow()
      
      expect(entry.agentId).toBe('agent_1')
    })

    it('entries are frozen on creation', () => {
      const entry = new AuditEntry('agent_1', 'principal_1', 'api_key', 'read', 'success', Date.now())

      expect(Object.isFrozen(entry)).toBe(true)
    })
  })

  describe('Replay Prevention', () => {
    it('prevents duplicate entry IDs', () => {
      const entry = new AuditEntry('agent_1', 'principal_1', 'api_key', 'read', 'success', Date.now())
      auditLog.append(entry)

      expect(() => auditLog.append(entry)).toThrowError('Entry ID already exists')
    })
  })

  describe('Timestamp Validation', () => {
    it('prevents backdating entries', () => {
      const pastTimestamp = Date.now() - 3600000

      expect(() => createAuditEntry({
        agentId: 'agent_1',
        principalId: 'principal_1',
        credentialType: 'api_key',
        action: 'read',
        result: 'success',
        timestamp: pastTimestamp
      })).toThrowError('Entry timestamp cannot be in the past')
    })

    it('prevents future-dated entries', () => {
      const futureTimestamp = Date.now() + 60000

      expect(() => createAuditEntry({
        agentId: 'agent_1',
        principalId: 'principal_1',
        credentialType: 'api_key',
        action: 'read',
        result: 'success',
        timestamp: futureTimestamp
      })).toThrowError('Entry timestamp cannot be in the future')
    })
  })

  describe('Hash Chain', () => {
    it('links entries via previous hash', () => {
      const entry1 = new AuditEntry('agent_1', 'principal_1', 'api_key', 'read', 'success', Date.now() - 1000)
      const hash1 = entry1.computeHash()
      
      const entry2 = new AuditEntry('agent_1', 'principal_1', 'api_key', 'write', 'success', Date.now(), undefined, hash1)

      expect(entry2.previousHash).toBe(hash1)
    })
  })

  describe('Credential Injection', () => {
    it('prevents credential in audit context', () => {
      expect(() => createAuditEntry({
        agentId: 'agent_1',
        principalId: 'principal_1',
        credentialType: 'payment_method',
        action: 'charge',
        result: 'success',
        context: { cardNumber: '4111111111111111' }
      })).toThrowError('Audit entry cannot contain credential values')
    })

    it('prevents credential fragment in audit context', () => {
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
