import { describe, it, expect, beforeEach } from 'vitest'
import { setRequestWorkflowStore, submitRequest, resolveRequestHitl, getRequestAudit, getRequestLineage } from '@/domain/services/request-workflow'
import { InMemoryRequestWorkflowStore } from '@/adapters/persistence/in-memory-request-workflow-store'
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
    if (sql.includes('INSERT INTO request_workflow_requests')) {
      const [request_id, principal_id, agent_id, action_type, payload_ref, request_timestamp, state, terminal, decision_context_hash, hitl_request_id, result_json] = args
      this.requests.set(String(request_id), { request_id, principal_id, agent_id, action_type, payload_ref, request_timestamp, state, terminal, decision_context_hash, hitl_request_id, result_json })
      return
    }
    if (sql.includes('INSERT INTO request_workflow_audit_events')) {
      const [request_id, event_json] = args
      const key = String(request_id)
      const arr = this.audits.get(key) ?? []
      arr.push({ event_json })
      this.audits.set(key, arr)
      return
    }
    if (sql.includes('INSERT INTO request_workflow_lineage_events')) {
      const [request_id, event_json] = args
      const key = String(request_id)
      const arr = this.lineage.get(key) ?? []
      arr.push({ event_json })
      this.lineage.set(key, arr)
      return
    }
    if (sql.includes('INSERT INTO request_workflow_escalation_buckets')) {
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

  all<T>(sql: string, args: unknown[]): T[] {
    if (sql.includes('FROM request_workflow_audit_events')) {
      return ((this.audits.get(String(args[0])) ?? []) as T[])
    }
    if (sql.includes('FROM request_workflow_lineage_events')) {
      return ((this.lineage.get(String(args[0])) ?? []) as T[])
    }
    return []
  }
}

describe('Request Workflow D1 Store Integration (WF5 C1+C2)', () => {
  beforeEach(() => {
    setRequestWorkflowStore(new InMemoryRequestWorkflowStore())
  })

  it('persists request and audit through D1 adapter', async () => {
    const fakeDb = new FakeD1() as unknown as D1Database
    setRequestWorkflowStore(new D1RequestWorkflowStore(fakeDb))

    const out = await submitRequest({
      requestId: 'd1-1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'amount:20',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { amount: 20 }
    })

    expect(out.requestId).toBe('d1-1')
    const audit = await getRequestAudit('d1-1')
    expect(audit.length).toBeGreaterThan(0)
  })

  it('persists terminal transition and lineage after HITL timeout through D1 adapter', async () => {
    const fakeDb = new FakeD1() as unknown as D1Database
    setRequestWorkflowStore(new D1RequestWorkflowStore(fakeDb))

    const out = await submitRequest({
      requestId: 'd1-2',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'amount:500',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { amount: 500 }
    })

    expect(out.decision).toBe('escalate')

    const timedOut = await resolveRequestHitl({
      requestId: out.requestId,
      hitlRequestId: out.hitlRequestId!,
      decision: 'timeout',
      timestamp: Date.now() + 600_000,
    })

    expect(timedOut.decision).toBe('deny')
    const audit = await getRequestAudit('d1-2')
    expect(audit.length).toBeGreaterThanOrEqual(2)

    const lineage = await getRequestLineage('d1-2')
    expect(lineage.length).toBeGreaterThanOrEqual(1)
  })
})
