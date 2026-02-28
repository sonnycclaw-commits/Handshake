import type { AuditEntry } from '../entities/audit-entry'

/**
 * Query filter for audit log queries
 */
export interface QueryFilter {
  agentId?: string
  principalId?: string
  startTime?: number
  endTime?: number
  result?: 'success' | 'failure' | 'denied'
  action?: string
  limit?: number
  offset?: number
}

/**
 * Export options
 */
export interface ExportOptions {
  format?: 'json' | 'csv'
}

/**
 * InMemoryAuditLog
 * 
 * Append-only audit log storage.
 * Core purpose: Store audit entries securely, support queries and export.
 */
export class InMemoryAuditLog {
  private entries: Map<string, AuditEntry> = new Map()

  /**
   * Append an entry to the log.
   * Throws if entry ID already exists.
   */
  append(entry: AuditEntry): void {
    if (this.entries.has(entry.id)) {
      throw new Error('Entry ID already exists')
    }
    this.entries.set(entry.id, entry)
  }

  /**
   * Get an entry by ID.
   * Returns null if not found.
   */
  get(id: string): AuditEntry | null {
    return this.entries.get(id) ?? null
  }

  /**
   * Delete is not allowed - audit log is append-only.
   */
  delete(): void {
    throw new Error('Audit log is append-only')
  }

  /**
   * Update is not allowed - audit log is append-only.
   */
  update(): void {
    throw new Error('Audit log is append-only')
  }

  /**
   * Get the count of entries.
   */
  count(): number {
    return this.entries.size
  }

  /**
   * Query entries with filters.
   */
  query(filter: QueryFilter): AuditEntry[] {
    let results = Array.from(this.entries.values())

    // Apply filters
    if (filter.agentId !== undefined) {
      results = results.filter(e => e.agentId === filter.agentId)
    }
    if (filter.principalId !== undefined) {
      results = results.filter(e => e.principalId === filter.principalId)
    }
    if (filter.result !== undefined) {
      results = results.filter(e => e.result === filter.result)
    }
    if (filter.action !== undefined) {
      results = results.filter(e => e.action === filter.action)
    }
    if (filter.startTime !== undefined) {
      results = results.filter(e => e.timestamp >= filter.startTime!)
    }
    if (filter.endTime !== undefined) {
      results = results.filter(e => e.timestamp <= filter.endTime!)
    }

    // Apply pagination
    if (filter.offset !== undefined) {
      results = results.slice(filter.offset)
    }
    if (filter.limit !== undefined) {
      results = results.slice(0, filter.limit)
    }

    return results
  }

  /**
   * Export entries to JSON or CSV format.
   */
  export(options?: ExportOptions): string {
    const entries = Array.from(this.entries.values())

    if (options?.format === 'csv') {
      const header = 'id,agentId,principalId,credentialType,action,result,timestamp'
      const rows = entries.map(e => 
        `${e.id},${e.agentId},${e.principalId},${e.credentialType},${e.action},${e.result},${e.timestamp}`
      )
      return [header, ...rows].join('\n')
    }

    return JSON.stringify(entries)
  }
}