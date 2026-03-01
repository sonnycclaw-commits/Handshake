import { describe, it, expect } from 'vitest'
import app from '@/index'

type Env = {
  DB: D1Database
  KV: KVNamespace
  ENVIRONMENT: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  JWT_PRIVATE_KEY: string
  JWT_PUBLIC_KEY: string
  JWT_KEY_ID: string
  IDENTITY_PROVIDER?: 'legacy' | 'clerk'
}

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
  hitl = new Map<string, any>()

  prepare(sql: string) { return new FakeStmt(this, sql) }

  run(sql: string, args: unknown[]) {
    if (sql.includes('INSERT INTO request_workflow_requests')) {
      const [request_id, principal_id, agent_id, action_type, payload_ref, request_timestamp, state, terminal, decision_context_hash, hitl_request_id, result_json, tenant_id] = args
      this.requests.set(String(request_id), { request_id, principal_id, tenant_id, agent_id, action_type, payload_ref, request_timestamp, state, terminal, decision_context_hash, hitl_request_id, result_json })
      return
    }
    if (sql.includes('INSERT INTO request_workflow_audit_events')) {
      const [request_id, event_json] = args
      const arr = this.audits.get(String(request_id)) ?? []
      arr.push({ event_json })
      this.audits.set(String(request_id), arr)
      return
    }
    if (sql.includes('INSERT INTO request_workflow_lineage_events')) {
      const [request_id, event_json] = args
      const arr = this.lineage.get(String(request_id)) ?? []
      arr.push({ event_json })
      this.lineage.set(String(request_id), arr)
      return
    }
    if (sql.includes('INSERT INTO request_workflow_escalation_buckets')) {
      this.buckets.set(String(args[0]), String(args[1]))
      return
    }
    if (sql.includes('INSERT INTO request_workflow_hitl_requests')) {
      const [id, agent_id, principal_id, tier, action, status, reason, approver_id, created_at, expires_at] = args
      this.hitl.set(String(id), { id, agent_id, principal_id, tier, action, status, reason, approver_id, created_at, expires_at })
      return
    }
  }

  first<T>(sql: string, args: unknown[]): T | null {
    if (sql.includes('FROM request_workflow_requests')) return (this.requests.get(String(args[0])) ?? null) as T | null
    if (sql.includes('FROM request_workflow_escalation_buckets')) {
      const val = this.buckets.get(String(args[0]))
      return (val ? ({ timestamps_json: val } as T) : null)
    }
    if (sql.includes('FROM request_workflow_hitl_requests')) return (this.hitl.get(String(args[0])) ?? null) as T | null
    return null
  }

  all<T>(sql: string, args: unknown[]): T[] {
    if (sql.includes('FROM request_workflow_audit_events')) return ((this.audits.get(String(args[0])) ?? []) as T[])
    if (sql.includes('FROM request_workflow_lineage_events')) return ((this.lineage.get(String(args[0])) ?? []) as T[])
    return []
  }
}

function makeEnv(): Env {
  return {
    DB: new FakeD1() as unknown as D1Database,
    KV: {} as KVNamespace,
    ENVIRONMENT: 'test',
    GOOGLE_CLIENT_ID: 'x',
    GOOGLE_CLIENT_SECRET: 'x',
    GITHUB_CLIENT_ID: 'x',
    GITHUB_CLIENT_SECRET: 'x',
    JWT_PRIVATE_KEY: 'x',
    JWT_PUBLIC_KEY: 'x',
    JWT_KEY_ID: 'x',
    IDENTITY_PROVIDER: 'legacy',
  }
}

describe('W4-D3 invariant: tenant isolation determinism', () => {
  it('enforces deterministic tenant mismatch reason across protected read endpoints', async () => {
    const env = makeEnv()

    const create = await app.fetch(new Request('http://local/workflow/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'w4-tenant-1',
        principalId: 'owner-1',
        tenantId: 'tenant-a',
        agentId: 'a1',
        actionType: 'payment',
        payloadRef: 'amount:20',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 20 },
      }),
    }), env)
    expect(create.status).toBe(200)

    const headers = {
      'x-identity-envelope': JSON.stringify({
        principalId: 'ops-1',
        tenantId: 'tenant-b',
        subjectType: 'human',
        roles: ['operator'],
        scopes: ['workflow:read:tenant'],
      }),
    }

    for (const p of ['/workflow/requests/w4-tenant-1', '/workflow/decision-room/w4-tenant-1', '/workflow/evidence/w4-tenant-1']) {
      const res = await app.fetch(new Request(`http://local${p}`, { headers }), env)
      expect(res.status).toBe(403)
      const body: any = await res.json()
      expect(body.reasonCode).toBe('security_read_tenant_mismatch')
      expect(body.responseClass).toBe('blocked')
    }
  })
})
