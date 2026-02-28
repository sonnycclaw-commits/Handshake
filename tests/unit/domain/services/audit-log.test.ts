import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryAuditLog, type QueryFilter } from '@/domain/services/audit-log'
import { AuditEntry } from '@/domain/entities/audit-entry'

/**
 * Test Fixtures for Audit Log
 */
const createTestEntry = (overrides: Partial<AuditEntry> = {}) => new AuditEntry(
  overrides.agentId ?? 'agent_1',
  overrides.principalId ?? 'principal_1',
  overrides.credentialType ?? 'payment_method',
  overrides.action ?? 'read',
  overrides.result ?? 'success',
  overrides.timestamp ?? Date.now()
)

/**
 * AuditLog Test Suite
 * 
 * Tests for append-only audit log storage.
 * Part of Phase 1: Audit Logging
 * 
 * TDD - These tests define expected behavior. Implementation follows.
 */

describe('AuditLog', () => {
  let auditLog: InMemoryAuditLog

  beforeEach(() => {
    auditLog = new InMemoryAuditLog()
  })

  describe('Append Operations', () => {
    it('appends entry to log', () => {
      // Arrange: Empty log and new entry
      const entry = createTestEntry()

      // Act: Append entry
      auditLog.append(entry)

      // Assert: Entry is in log
      expect(auditLog.count()).toBe(1)
      expect(auditLog.get(entry.id)).toEqual(entry)
    })

    it('prevents modification of appended entry', () => {
      // Arrange: Appended entry
      const entry = createTestEntry()
      auditLog.append(entry)

      // Act: Attempt to modify
      const retrieved = auditLog.get(entry.id)
      
      // Assert: Modification fails (frozen)
      expect(Object.isFrozen(retrieved)).toBe(true)
    })

    it('enforces append-only (no delete)', () => {
      // Arrange: Log with entry
      const entry = createTestEntry()
      auditLog.append(entry)

      // Act & Assert: Delete throws error
      expect(() => auditLog.delete(entry.id)).toThrowError('Audit log is append-only')
    })

    it('enforces append-only (no update)', () => {
      // Arrange: Log with entry
      const entry = createTestEntry()
      auditLog.append(entry)

      // Act & Assert: Update throws error
      const modifiedEntry = createTestEntry({ id: entry.id, action: 'write' })
      expect(() => auditLog.update(modifiedEntry)).toThrowError('Audit log is append-only')
    })
  })

  describe('Retrieval Operations', () => {
    it('retrieves entry by ID', () => {
      // Arrange: Log with entry
      const entry = createTestEntry()
      auditLog.append(entry)

      // Act: Get by ID
      const retrieved = auditLog.get(entry.id)

      // Assert: Entry returned
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(entry.id)
    })

    it('returns null for non-existent entry', () => {
      // Arrange: Empty log

      // Act: Get non-existent ID
      const result = auditLog.get('nonexistent_id')

      // Assert: Returns null
      expect(result).toBeNull()
    })

    it('returns count of entries', () => {
      // Arrange: Log with multiple entries
      for (let i = 0; i < 50; i++) {
        auditLog.append(createTestEntry())
      }

      // Act: Get count
      const count = auditLog.count()

      // Assert: Correct count
      expect(count).toBe(50)
    })
  })

  describe('Query Operations', () => {
    beforeEach(() => {
      // Populate log with diverse entries
      const now = Date.now()
      
      // Agent 1 entries
      auditLog.append(createTestEntry({ agentId: 'agent_1', principalId: 'principal_1', timestamp: now - 5000, result: 'success' }))
      auditLog.append(createTestEntry({ agentId: 'agent_1', principalId: 'principal_2', timestamp: now - 4000, result: 'failure' }))
      auditLog.append(createTestEntry({ agentId: 'agent_1', principalId: 'principal_1', timestamp: now - 3000, result: 'success' }))
      
      // Agent 2 entries
      auditLog.append(createTestEntry({ agentId: 'agent_2', principalId: 'principal_1', timestamp: now - 2000, result: 'denied' }))
      auditLog.append(createTestEntry({ agentId: 'agent_2', principalId: 'principal_2', timestamp: now - 1000, result: 'success' }))
    })

    it('queries by agentId', () => {
      // Act: Query for agent_1
      const results = auditLog.query({ agentId: 'agent_1' } as QueryFilter)

      // Assert: Only agent_1 entries returned
      expect(results).toHaveLength(3)
      expect(results.every(e => e.agentId === 'agent_1')).toBe(true)
    })

    it('queries by principalId', () => {
      // Act: Query for principal_1
      const results = auditLog.query({ principalId: 'principal_1' } as QueryFilter)

      // Assert: Only principal_1 entries returned
      expect(results).toHaveLength(3)
      expect(results.every(e => e.principalId === 'principal_1')).toBe(true)
    })

    it('queries by time range', () => {
      // Arrange: Time range
      const now = Date.now()
      const startTime = now - 3500
      const endTime = now - 1500

      // Act: Query time range
      const results = auditLog.query({ startTime, endTime } as QueryFilter)

      // Assert: Entries in range returned
      expect(results.length).toBeGreaterThan(0)
      expect(results.every(e => e.timestamp >= startTime && e.timestamp <= endTime)).toBe(true)
    })

    it('queries by result status', () => {
      // Act: Query for failures
      const results = auditLog.query({ result: 'failure' } as QueryFilter)

      // Assert: Only failures returned
      expect(results).toHaveLength(1)
      expect(results.every(e => e.result === 'failure')).toBe(true)
    })

    it('combines multiple filters', () => {
      // Arrange: Combined filters
      const now = Date.now()

      // Act: Query with multiple filters
      const results = auditLog.query({
        agentId: 'agent_1',
        result: 'success',
        startTime: now - 6000
      } as QueryFilter)

      // Assert: All filters applied
      expect(results.length).toBeGreaterThan(0)
      expect(results.every(e => 
        e.agentId === 'agent_1' && 
        e.result === 'success' && 
        e.timestamp >= now - 6000
      )).toBe(true)
    })

    it('paginates results', () => {
      // Act: Query with pagination
      const page1 = auditLog.query({ limit: 2, offset: 0 } as QueryFilter)
      const page2 = auditLog.query({ limit: 2, offset: 2 } as QueryFilter)

      // Assert: Correct pagination
      expect(page1).toHaveLength(2)
      expect(page2).toHaveLength(2)
    })
  })

  describe('Export Operations', () => {
    beforeEach(() => {
      auditLog.append(createTestEntry())
      auditLog.append(createTestEntry())
    })

    it('exports to JSON', () => {
      // Act: Export as JSON
      const json = auditLog.export()

      // Assert: Valid JSON with entries
      const parsed = JSON.parse(json)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(2)
    })

    it('exports to CSV', () => {
      // Act: Export as CSV
      const csv = auditLog.export({ format: 'csv' })

      // Assert: CSV format with headers
      expect(csv).toContain('id,agentId,principalId')
      expect(csv.split('\n').length).toBe(3) // Header + 2 rows
    })
  })
})
