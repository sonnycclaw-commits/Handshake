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
  linkages = new Map<string, any>()
  audits = new Map<string, any[]>()
  lineage = new Map<string, any[]>()
  buckets = new Map<string, string>()
  hitl = new Map<string, any>()
  policyActive = new Map<string, any>()
  policyVersions = new Map<string, any>()
  policyAudit = new Map<string, any>()
  metricsEvents: any[] = []
  hourly = new Map<string, any>()
  daily = new Map<string, any>()

  constructor() {
    this.linkages.set('agent_alpha', { agent_id: 'agent_alpha', revoked_at: null })
    this.linkages.set('agent_beta', { agent_id: 'agent_beta', revoked_at: null })

    const now = Date.now()
    this.requests.set('req_1', {
      request_id: 'req_1',
      principal_id: 'p1',
      agent_id: 'agent_alpha',
      action_type: 'payment',
      payload_ref: 'amount:500',
      request_timestamp: now - 1000,
      state: 'escalated_pending',
      terminal: 0,
      decision_context_hash: 'ctx_1',
      hitl_request_id: 'hitl_1',
      result_json: JSON.stringify({
        requestId: 'req_1',
        decision: 'escalate',
        reasonCode: 'hitl_boundary_escalated',
        tier: 3,
        timestamp: now - 1000,
        decisionContextHash: 'ctx_1',
        hitlRequestId: 'hitl_1',
      })
    })

    this.requests.set('req_2', {
      request_id: 'req_2',
      principal_id: 'p1',
      agent_id: 'agent_beta',
      action_type: 'other',
      payload_ref: 'safe-op',
      request_timestamp: now - 2000,
      state: 'allowed_terminal',
      terminal: 1,
      decision_context_hash: 'ctx_2',
      hitl_request_id: null,
      result_json: JSON.stringify({
        requestId: 'req_2',
        decision: 'allow',
        reasonCode: 'policy_allow',
        tier: 1,
        timestamp: now - 2000,
        decisionContextHash: 'ctx_2',
      })
    })
  }

  prepare(sql: string) { return new FakeStmt(this, sql) }

  run(sql: string, args: unknown[]) {
    // Keep compatibility for other routes if invoked
    if (sql.includes('INSERT INTO request_workflow_requests')) {
      const [request_id, principal_id, agent_id, action_type, payload_ref, request_timestamp, state, terminal, decision_context_hash, hitl_request_id, result_json] = args
      this.requests.set(String(request_id), { request_id, principal_id, agent_id, action_type, payload_ref, request_timestamp, state, terminal, decision_context_hash, hitl_request_id, result_json })
      return
    }
  }

  first<T>(sql: string, args: unknown[]): T | null {
    if (sql.includes('FROM linkages WHERE agent_id = ?')) {
      return (this.linkages.get(String(args[0])) ?? null) as T | null
    }
    if (sql.includes('FROM request_workflow_requests')) {
      return (this.requests.get(String(args[0])) ?? null) as T | null
    }
    return null
  }

  all<T>(sql: string, args: unknown[]): T[] {
    if (sql.includes('SELECT agent_id, revoked_at FROM linkages')) {
      return Array.from(this.linkages.values()) as T[]
    }

    if (sql.includes('FROM request_workflow_requests WHERE agent_id = ?')) {
      const agentId = String(args[0])
      const rows = Array.from(this.requests.values())
        .filter((r) => r.agent_id === agentId)
        .sort((a, b) => Number(b.request_timestamp) - Number(a.request_timestamp))
      return rows as T[]
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

describe('Agents rail transport', () => {
  it('lists agents with risk/status/drift fields', async () => {
    const env = makeEnv()
    const res = await app.fetch(new Request('http://local/agents'), env)
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(Array.isArray(body.agents)).toBe(true)
    expect(body.agents.length).toBeGreaterThan(0)

    const alpha = body.agents.find((a: any) => a.agentId === 'agent_alpha')
    expect(alpha).toBeTruthy()
    expect(['low', 'medium', 'high', 'critical', 'unknown']).toContain(alpha.riskTier)
    expect(typeof alpha.status).toBe('string')
    expect(typeof alpha.driftScore).toBe('number')
  })

  it('returns agent detail with recent requests', async () => {
    const env = makeEnv()
    const res = await app.fetch(new Request('http://local/agents/agent_alpha'), env)
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.agentId).toBe('agent_alpha')
    expect(Array.isArray(body.recentRequests)).toBe(true)
    expect(body.recentRequests.length).toBeGreaterThan(0)
    expect(['allow', 'deny', 'escalate']).toContain(body.recentRequests[0].decision)
  })

  it('returns not found for unknown agent', async () => {
    const env = makeEnv()
    const res = await app.fetch(new Request('http://local/agents/agent_unknown'), env)
    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.reasonCode).toBe('hitl_request_not_found')
    expect(body.error).toBe('hitl_request_not_found')
  })
})
