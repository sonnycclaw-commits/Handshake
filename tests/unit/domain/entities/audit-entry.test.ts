import { describe, it, expect, beforeEach } from 'vitest'
import { AuditEntry } from '@/domain/entities/audit-entry'

/**
 * AuditEntry Tests
 * 
 * What matters: Entries are immutable, unique, and hash consistently.
 */

describe('AuditEntry', () => {
  describe('Creation', () => {
    it('creates entry with required fields', () => {
      const entry = new AuditEntry('agent_1', 'principal_1', 'api_key', 'read', 'success', Date.now())

      expect(entry.agentId).toBe('agent_1')
      expect(entry.principalId).toBe('principal_1')
      expect(entry.credentialType).toBe('api_key')
      expect(entry.action).toBe('read')
      expect(entry.result).toBe('success')
    })

    it('creates entry with context', () => {
      const context = { riskScore: 0.5, guardrails: ['limit'] }
      const entry = new AuditEntry('agent_1', 'principal_1', 'api_key', 'read', 'success', Date.now(), context)

      expect(entry.context?.riskScore).toBe(0.5)
      expect(entry.context?.guardrails).toContain('limit')
    })

    it('generates unique IDs', () => {
      const entry1 = new AuditEntry('agent_1', 'principal_1', 'api_key', 'read', 'success', Date.now())
      const entry2 = new AuditEntry('agent_1', 'principal_1', 'api_key', 'read', 'success', Date.now())

      expect(entry1.id).not.toBe(entry2.id)
    })

    it('computes consistent hash', () => {
      const entry = new AuditEntry('agent_1', 'principal_1', 'api_key', 'read', 'success', 1000)

      expect(entry.computeHash()).toBe(entry.computeHash())
      expect(entry.computeHash()).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('Immutability', () => {
    it('freezes entry on creation', () => {
      const entry = new AuditEntry('agent_1', 'principal_1', 'api_key', 'read', 'success', Date.now())

      expect(Object.isFrozen(entry)).toBe(true)
      expect(() => { (entry as any).agentId = 'hacked' }).toThrow()
    })

    it('freezes context', () => {
      const entry = new AuditEntry('agent_1', 'principal_1', 'api_key', 'read', 'success', Date.now(), { riskScore: 0.5 })

      expect(Object.isFrozen(entry.context)).toBe(true)
    })
  })

  describe('Hash Chain', () => {
    it('links to previous entry', () => {
      const entry1 = new AuditEntry('agent_1', 'principal_1', 'api_key', 'read', 'success', Date.now())
      const entry2 = new AuditEntry('agent_1', 'principal_1', 'api_key', 'write', 'success', Date.now(), undefined, entry1.computeHash())

      expect(entry2.previousHash).toBe(entry1.computeHash())
    })
  })
})
