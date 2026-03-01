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
  CLERK_JWT_KEY?: string
  CLERK_SECRET_KEY?: string
  CLERK_AUDIENCE?: string
  CLERK_AUTHORIZED_PARTIES?: string
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
  metricsEvents: any[] = []
  hourly = new Map<string, any>()
  daily = new Map<string, any>()

  prepare(sql: string) { return new FakeStmt(this, sql) }

  run(sql: string, args: unknown[]) {
    if (sql.includes('INSERT INTO request_workflow_requests')) {
      const [request_id, principal_id, agent_id, action_type, payload_ref, request_timestamp, state, terminal, decision_context_hash, hitl_request_id, result_json] = args
      this.requests.set(String(request_id), { request_id, principal_id, agent_id, action_type, payload_ref, request_timestamp, state, terminal, decision_context_hash, hitl_request_id, result_json })
      return
    }
    if (sql.includes('INSERT INTO request_workflow_audit_events')) {
      const [request_id, event_json] = args
      const k = String(request_id)
      const arr = this.audits.get(k) ?? []
      arr.push({ event_json })
      this.audits.set(k, arr)
      return
    }
    if (sql.includes('INSERT INTO request_workflow_lineage_events')) {
      const [request_id, event_json] = args
      const k = String(request_id)
      const arr = this.lineage.get(k) ?? []
      arr.push({ event_json })
      this.lineage.set(k, arr)
      return
    }
    if (sql.includes('INSERT INTO request_workflow_escalation_buckets')) {
      const [bucket_key, timestamps_json] = args
      this.buckets.set(String(bucket_key), String(timestamps_json))
      return
    }
    if (sql.includes('INSERT INTO request_workflow_hitl_requests')) {
      const [id, agent_id, principal_id, tier, action, status, reason, approver_id, created_at, expires_at] = args
      this.hitl.set(String(id), { id, agent_id, principal_id, tier, action, status, reason, approver_id, created_at, expires_at })
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
    if (sql.includes('FROM request_workflow_hitl_requests')) {
      return (this.hitl.get(String(args[0])) ?? null) as T | null
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

describe('AP6 W1 RED — identity envelope first', () => {
  it('requires canonical identity envelope for decision actions (reject path)', async () => {
    const env = makeEnv()

    const createdRes = await app.fetch(new Request('http://local/workflow/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'ap6-w1-red-1',
        principalId: 'p1',
        agentId: 'a1',
        actionType: 'payment',
        payloadRef: 'amount:500',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 500 }
      })
    }), env)

    const created: any = await createdRes.json()
    expect(created.decision).toBe('escalate')

    const actionRes = await app.fetch(new Request('http://local/workflow/decision-room/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: created.requestId,
        hitlRequestId: created.hitlRequestId,
        action: 'reject'
      })
    }), env)

    expect(actionRes.status).toBe(401)
    const body: any = await actionRes.json()
    expect(body.reasonCode).toBe('security_missing_identity_envelope')
  })

  it('rejects raw provider-style authorization in favor of middleware envelope context', async () => {
    const env = makeEnv()

    const createdRes = await app.fetch(new Request('http://local/workflow/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'ap6-w1-red-2',
        principalId: 'p1',
        agentId: 'a1',
        actionType: 'payment',
        payloadRef: 'amount:500',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 500 }
      })
    }), env)

    const created: any = await createdRes.json()
    expect(created.decision).toBe('escalate')

    const approveRes = await app.fetch(new Request('http://local/workflow/decision-room/action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer principal:p1'
      },
      body: JSON.stringify({
        requestId: created.requestId,
        hitlRequestId: created.hitlRequestId,
        action: 'approve'
      })
    }), env)

    expect(approveRes.status).toBe(401)
    const body: any = await approveRes.json()
    expect(body.reasonCode).toBe('security_missing_identity_envelope')
  })

  it('rejects malformed identity envelope even when authorization header is present', async () => {
    const env = makeEnv()

    const createdRes = await app.fetch(new Request('http://local/workflow/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'ap6-w1-red-3',
        principalId: 'p1',
        agentId: 'a1',
        actionType: 'payment',
        payloadRef: 'amount:500',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 500 }
      })
    }), env)

    const created: any = await createdRes.json()
    expect(created.decision).toBe('escalate')

    const res = await app.fetch(new Request('http://local/workflow/decision-room/action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer principal:p1',
        'x-identity-envelope': '{malformed-json',
      },
      body: JSON.stringify({
        requestId: created.requestId,
        hitlRequestId: created.hitlRequestId,
        action: 'approve',
      })
    }), env)

    expect(res.status).toBe(401)
    const body: any = await res.json()
    expect(body.reasonCode).toBe('security_invalid_identity_envelope')
  })

  it('rejects envelope containing unexpected fields', async () => {
    const env = makeEnv()

    const createdRes = await app.fetch(new Request('http://local/workflow/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'ap6-w1-red-4',
        principalId: 'p1',
        agentId: 'a1',
        actionType: 'payment',
        payloadRef: 'amount:500',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 500 }
      })
    }), env)

    const created: any = await createdRes.json()
    expect(created.decision).toBe('escalate')

    const res = await app.fetch(new Request('http://local/workflow/decision-room/action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-identity-envelope': JSON.stringify({
          principalId: 'p1',
          subjectType: 'human',
          roles: [],
          scopes: [],
          hack: true,
        }),
      },
      body: JSON.stringify({
        requestId: created.requestId,
        hitlRequestId: created.hitlRequestId,
        action: 'approve',
      })
    }), env)

    expect(res.status).toBe(401)
    const body: any = await res.json()
    expect(body.reasonCode).toBe('security_invalid_identity_envelope')
  })

  it('rejects envelope with non-array scopes/roles', async () => {
    const env = makeEnv()

    const createdRes = await app.fetch(new Request('http://local/workflow/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'ap6-w1-red-5',
        principalId: 'p1',
        agentId: 'a1',
        actionType: 'payment',
        payloadRef: 'amount:500',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 500 }
      })
    }), env)

    const created: any = await createdRes.json()
    expect(created.decision).toBe('escalate')

    const res = await app.fetch(new Request('http://local/workflow/decision-room/action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-identity-envelope': JSON.stringify({
          principalId: 'p1',
          subjectType: 'human',
          roles: 'admin',
          scopes: [],
        }),
      },
      body: JSON.stringify({
        requestId: created.requestId,
        hitlRequestId: created.hitlRequestId,
        action: 'approve',
      })
    }), env)

    expect(res.status).toBe(401)
    const body: any = await res.json()
    expect(body.reasonCode).toBe('security_invalid_identity_envelope')
  })

  it('accepts canonical envelope and succeeds', async () => {
    const env = makeEnv()

    const createdRes = await app.fetch(new Request('http://local/workflow/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'ap6-w1-red-6',
        principalId: 'p1',
        agentId: 'a1',
        actionType: 'payment',
        payloadRef: 'amount:500',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 500 }
      })
    }), env)

    const created: any = await createdRes.json()
    expect(created.decision).toBe('escalate')

    const res = await app.fetch(new Request('http://local/workflow/decision-room/action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-identity-envelope': JSON.stringify({
          principalId: 'p1',
          subjectType: 'human',
          roles: ['operator'],
          scopes: ['workflow:resolve'],
          issuer: 'clerk',
          sessionId: 'sess_1',
          tenantId: 'tenant_1',
        }),
      },
      body: JSON.stringify({
        requestId: created.requestId,
        hitlRequestId: created.hitlRequestId,
        action: 'approve',
      })
    }), env)

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.status).toBe('ok')
    expect(body.reasonCode).toBe('hitl_approved')
  })
})
