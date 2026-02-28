import { describe, it, expect } from 'vitest'
import { setHITLStore, createHITLRequest, getHITLRequest, approveHITL } from '@/domain/services/hitl-workflow'
import { D1HITLStore } from '@/adapters/persistence/d1-hitl-store'
import { InMemoryHITLStore } from '@/adapters/persistence/in-memory-hitl-store'

class FakeStmt {
  private sql: string
  private db: FakeD1
  private args: unknown[] = []
  constructor(db: FakeD1, sql: string) { this.db = db; this.sql = sql }
  bind(...args: unknown[]) { this.args = args; return this }
  async run() { this.db.run(this.sql, this.args); return { success: true } }
  async first<T>() { return this.db.first<T>(this.sql, this.args) }
}

class FakeD1 {
  hitl = new Map<string, any>()
  prepare(sql: string) { return new FakeStmt(this, sql) }
  run(sql: string, args: unknown[]) {
    if (sql.includes('request_workflow_hitl_requests')) {
      const [id, agent_id, principal_id, tier, action, status, reason, approver_id, created_at, expires_at] = args
      this.hitl.set(String(id), { id, agent_id, principal_id, tier, action, status, reason, approver_id, created_at, expires_at })
    }
  }
  first<T>(sql: string, args: unknown[]): T | null {
    if (sql.includes('request_workflow_hitl_requests')) {
      return (this.hitl.get(String(args[0])) ?? null) as T | null
    }
    return null
  }
}

describe('HITL D1 Store Integration (C3)', () => {
  it('persists and retrieves hitl request from D1 adapter path', async () => {
    const fakeDb = new FakeD1() as unknown as D1Database
    setHITLStore(new D1HITLStore(fakeDb))

    const created = await createHITLRequest({
      agentId: 'a1',
      principalId: 'p1',
      tier: 3,
      action: 'payment'
    })

    const loaded = await getHITLRequest(created.id)
    expect(loaded).toBeTruthy()
    expect(loaded?.status).toBe('pending')

    const approved = await approveHITL(created.id, { approverId: 'p1' })
    expect(approved.status).toBe('approved')
  })

  it('can switch back to in-memory store safely', async () => {
    setHITLStore(new InMemoryHITLStore())
    const created = await createHITLRequest({ agentId: 'a2', principalId: 'p2', tier: 3, action: 'payment' })
    const loaded = await getHITLRequest(created.id)
    expect(loaded?.id).toBe(created.id)
  })
})
