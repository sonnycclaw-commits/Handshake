import { describe, it, expect } from 'vitest'
import app from '@/index'
import { createInternalTrustToken } from '@/middleware/internal-trust-context'

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
  INTERNAL_TRUST_SHARED_SECRET?: string
}

class FakeKV {
  private m = new Map<string, string>()
  async get(key: string): Promise<string | null> { return this.m.has(key) ? this.m.get(key)! : null }
  async put(key: string, value: string): Promise<void> { this.m.set(key, value) }
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
  policyActive = new Map<string, any>()
  policyVersions = new Map<string, any>()
  policyAudit = new Map<string, any>()
  replayGuards = new Map<string, any>()

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

    if (sql.includes('INSERT INTO replay_guards')) {
      const [guard_key, scope, created_at, expires_at] = args
      const key = String(guard_key)
      if (this.replayGuards.has(key)) {
        throw new Error('UNIQUE constraint failed: replay_guards.guard_key')
      }
      this.replayGuards.set(key, { guard_key, scope, created_at, expires_at })
      return
    }

    if (sql.includes('INSERT INTO policy_active_configs')) {
      const [scope, scope_id, version_id, rules_json, updated_at] = args
      this.policyActive.set(`${scope}:${scope_id}`, { scope, scope_id, version_id, rules_json, updated_at })
      return
    }
    if (sql.includes('INSERT INTO policy_versions')) {
      const [version_id, scope, scope_id, rules_json, created_at] = args
      if (!this.policyVersions.has(String(version_id))) {
        this.policyVersions.set(String(version_id), { version_id, scope, scope_id, rules_json, created_at })
      }
      return
    }
    if (sql.includes('INSERT INTO policy_audit_events')) {
      const [event_id, scope, scope_id, version_id, event_type, event_json, created_at] = args
      this.policyAudit.set(String(event_id), { event_id, scope, scope_id, version_id, event_type, event_json, created_at })
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
    if (sql.includes('FROM policy_active_configs')) {
      const [scope, scope_id] = args
      return (this.policyActive.get(`${scope}:${scope_id}`) ?? null) as T | null
    }
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
    KV: new FakeKV() as unknown as KVNamespace,
    ENVIRONMENT: 'test',
    GOOGLE_CLIENT_ID: 'x',
    GOOGLE_CLIENT_SECRET: 'x',
    GITHUB_CLIENT_ID: 'x',
    GITHUB_CLIENT_SECRET: 'x',
    JWT_PRIVATE_KEY: 'x',
    JWT_PUBLIC_KEY: 'x',
    JWT_KEY_ID: 'x',
    IDENTITY_PROVIDER: 'legacy',
    INTERNAL_TRUST_SHARED_SECRET: 'trust-secret-test',
  }
}

function makeTrustToken(secret: string, override?: Partial<{ iat: number; exp: number; jti: string; sub: string }>) {
  const nowSec = Math.floor(Date.now() / 1000)
  return createInternalTrustToken({
    iss: 'handshake-edge',
    aud: 'handshake-core',
    sub: override?.sub ?? 'policy.apply',
    iat: override?.iat ?? nowSec,
    exp: override?.exp ?? (nowSec + 60),
    jti: override?.jti ?? 'jti-12345678',
  }, secret)
}

describe('AP6 W2 RED — trust boundary hardening', () => {
  it('rejects policy apply without internal trust context envelope', async () => {
    const env = makeEnv()
    const res = await app.fetch(new Request('http://local/policy/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-identity-envelope': JSON.stringify({ principalId: 'p1', subjectType: 'human', roles: [], scopes: [] }) },
      body: JSON.stringify({
        scope: 'global',
        rules: [{ id: 'r1', key: 'max_payment', value: 50 }]
      })
    }), env)

    expect(res.status).toBe(401)
    const body: any = await res.json()
    expect(body.reasonCode).toBe('security_missing_internal_trust_context')
  })

  it('rejects policy apply with malformed internal trust token', async () => {
    const env = makeEnv()
    const res = await app.fetch(new Request('http://local/policy/apply', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-identity-envelope': JSON.stringify({ principalId: 'p1', subjectType: 'human', roles: [], scopes: [] }),
        'x-internal-trust-context': 'not-a-token',
      },
      body: JSON.stringify({
        scope: 'global',
        rules: [{ id: 'r1', key: 'max_payment', value: 50 }]
      })
    }), env)

    expect(res.status).toBe(401)
    const body: any = await res.json()
    expect(body.reasonCode).toBe('security_invalid_internal_trust_context')
  })

  it('rejects policy apply with invalid signature', async () => {
    const env = makeEnv()
    const token = makeTrustToken('different-secret')

    const res = await app.fetch(new Request('http://local/policy/apply', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-identity-envelope': JSON.stringify({ principalId: 'p1', subjectType: 'human', roles: [], scopes: [] }),
        'x-internal-trust-context': token,
      },
      body: JSON.stringify({
        scope: 'global',
        rules: [{ id: 'r1', key: 'max_payment', value: 50 }]
      })
    }), env)

    expect(res.status).toBe(401)
    const body: any = await res.json()
    expect(body.reasonCode).toBe('security_invalid_internal_trust_context')
  })

  it('rejects policy apply with expired trust token', async () => {
    const env = makeEnv()
    const nowSec = Math.floor(Date.now() / 1000)
    const token = makeTrustToken(env.INTERNAL_TRUST_SHARED_SECRET!, {
      iat: nowSec - 120,
      exp: nowSec - 60,
      jti: 'jti-expired-1234',
    })

    const res = await app.fetch(new Request('http://local/policy/apply', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-identity-envelope': JSON.stringify({ principalId: 'p1', subjectType: 'human', roles: [], scopes: [] }),
        'x-internal-trust-context': token,
      },
      body: JSON.stringify({
        scope: 'global',
        rules: [{ id: 'r1', key: 'max_payment', value: 50 }]
      })
    }), env)

    expect(res.status).toBe(401)
    const body: any = await res.json()
    expect(body.reasonCode).toBe('security_internal_trust_context_expired')
  })

  it('accepts policy apply with valid signed trust token', async () => {
    const env = makeEnv()
    const token = makeTrustToken(env.INTERNAL_TRUST_SHARED_SECRET!)

    const res = await app.fetch(new Request('http://local/policy/apply', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-identity-envelope': JSON.stringify({ principalId: 'p1', subjectType: 'human', roles: [], scopes: [] }),
        'x-internal-trust-context': token,
      },
      body: JSON.stringify({
        scope: 'global',
        rules: [{ id: 'r1', key: 'max_payment', value: 50 }]
      })
    }), env)

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.status).toBe('ok')
    expect(typeof body.policyVersion).toBe('string')
  })

  it('rejects replayed decision action using idempotency key', async () => {
    const env = makeEnv()

    const createdRes = await app.fetch(new Request('http://local/workflow/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'ap6-w2-red-1',
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

    const headers = {
      'content-type': 'application/json',
      'x-identity-envelope': JSON.stringify({ principalId: 'p1', subjectType: 'human', roles: [], scopes: [] }),
      'x-idempotency-key': 'idem-ap6-red-1'
    }

    const first = await app.fetch(new Request('http://local/workflow/decision-room/action', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requestId: created.requestId,
        hitlRequestId: created.hitlRequestId,
        action: 'reject'
      })
    }), env)

    expect(first.status).toBe(200)

    const second = await app.fetch(new Request('http://local/workflow/decision-room/action', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requestId: created.requestId,
        hitlRequestId: created.hitlRequestId,
        action: 'reject'
      })
    }), env)

    expect(second.status).toBe(409)
    const body: any = await second.json()
    expect(body.reasonCode).toBe('security_replay_detected')
  })
})
