import { describe, it, expect } from 'vitest'
import { setRequestWorkflowStore, submitRequest } from '@/domain/services/request-workflow'
import { D1RequestWorkflowStore } from '@/adapters/persistence/d1-request-workflow-store'

class FakeStmt {
  private sql: string
  private db: FakeD1
  private args: unknown[] = []
  constructor(db: FakeD1, sql: string) { this.db = db; this.sql = sql }
  bind(...args: unknown[]) { this.args = args; return this }
  async run() { this.db.run(this.sql, this.args); return { success: true } }
  async first<T>() { return this.db.first<T>(this.sql, this.args) }
  async all<T>() { return { results: this.db.all<T>(this.sql, this.args) } }
}

class FakeD1 {
  requests = new Map<string, any>()
  audits = new Map<string, any[]>()
  lineage = new Map<string, any[]>()
  buckets = new Map<string, string>()

  prepare(sql: string) { return new FakeStmt(this, sql) }

  run(sql: string, args: unknown[]) {
    if (sql.includes('request_workflow_requests')) {
      const [request_id, principal_id, agent_id, action_type, payload_ref, request_timestamp, state, terminal, decision_context_hash, hitl_request_id, result_json] = args
      this.requests.set(String(request_id), { request_id, principal_id, agent_id, action_type, payload_ref, request_timestamp, state, terminal, decision_context_hash, hitl_request_id, result_json })
      return
    }
    if (sql.includes('request_workflow_audit_events')) {
      const [request_id, event_json] = args
      const arr = this.audits.get(String(request_id)) ?? []
      arr.push({ event_json })
      this.audits.set(String(request_id), arr)
      return
    }
    if (sql.includes('request_workflow_lineage_events')) {
      const [request_id, event_json] = args
      const arr = this.lineage.get(String(request_id)) ?? []
      arr.push({ event_json })
      this.lineage.set(String(request_id), arr)
      return
    }
    if (sql.includes('request_workflow_escalation_buckets')) {
      const [bucket_key, timestamps_json] = args
      this.buckets.set(String(bucket_key), String(timestamps_json))
      return
    }
  }

  first<T>(sql: string, args: unknown[]): T | null {
    if (sql.includes('FROM request_workflow_requests')) {
      return (this.requests.get(String(args[0])) ?? null) as T | null
    }
    if (sql.includes('FROM request_workflow_escalation_buckets')) {
      const val = this.buckets.get(String(args[0]))
      return (val ? ({ timestamps_json: val } as T) : null)
    }
    return null
  }

  all<T>(_sql: string, _args: unknown[]): T[] {
    return []
  }
}

describe('Request escalation durable continuity (C4)', () => {
  it('throttle survives store rebind (simulated process restart)', async () => {
    const fakeDb = new FakeD1() as unknown as D1Database
    const storeA = new D1RequestWorkflowStore(fakeDb)
    setRequestWorkflowStore(storeA)

    const principalId = 'p-cont'
    const agentId = 'a-cont'

    for (let i = 0; i < 5; i++) {
      const out = await submitRequest({
        requestId: `cont-a-${i}`,
        principalId,
        agentId,
        actionType: 'payment',
        payloadRef: 'amount:999',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 999 }
      })
      expect(['escalate', 'deny']).toContain(out.decision)
    }

    // Simulate restart: new adapter instance, same underlying durable DB
    const storeB = new D1RequestWorkflowStore(fakeDb)
    setRequestWorkflowStore(storeB)

    const afterRestart = await submitRequest({
      requestId: 'cont-b-1',
      principalId,
      agentId,
      actionType: 'payment',
      payloadRef: 'amount:999',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { amount: 999 }
    })

    expect(afterRestart.decision).toBe('deny')
    expect(afterRestart.reasonCode).toBe('security_escalation_flood_throttled')
  })
})
