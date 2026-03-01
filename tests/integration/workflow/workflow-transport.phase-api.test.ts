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
    if (sql.includes('INSERT INTO metrics_events')) {
      const [event_id, request_id, timestamp_ms, decision, reason_code, reason_family, risk_tier, is_terminal, has_valid_lineage, incident_detected_ts_ms, terminal_decision_ts_ms, human_minutes, compute_cost_units, escalation_overhead_units, schema_version, projector_version] = args
      this.metricsEvents.push({ event_id, request_id, timestamp_ms, decision, reason_code, reason_family, risk_tier, is_terminal, has_valid_lineage, incident_detected_ts_ms, terminal_decision_ts_ms, human_minutes, compute_cost_units, escalation_overhead_units, schema_version, projector_version })
      return
    }
    if (sql.includes('INSERT INTO metrics_rollups_hourly')) {
      const [bucket_start_ms, metric_name, dimension_key, value_real, sample_count, schema_version, projector_version] = args
      this.hourly.set(`${bucket_start_ms}:${metric_name}:${dimension_key}`, { bucket_start_ms, metric_name, dimension_key, value_real, sample_count, schema_version, projector_version })
      return
    }
    if (sql.includes('INSERT INTO metrics_rollups_daily')) {
      const [bucket_start_ms, metric_name, dimension_key, value_real, sample_count, schema_version, projector_version] = args
      this.daily.set(`${bucket_start_ms}:${metric_name}:${dimension_key}`, { bucket_start_ms, metric_name, dimension_key, value_real, sample_count, schema_version, projector_version })
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
    if (sql.includes('FROM metrics_events')) {
      const [start, end] = args as [number, number]
      return this.metricsEvents.filter((r) => Number(r.timestamp_ms) >= Number(start) && Number(r.timestamp_ms) < Number(end)) as T[]
    }
    if (sql.includes('FROM metrics_rollups_hourly') || sql.includes('FROM metrics_rollups_daily')) {
      const source = sql.includes('metrics_rollups_hourly') ? this.hourly : this.daily
      const [metricName, start, end] = args as [string, number, number]
      return Array.from(source.values()).filter((r: any) => r.metric_name === metricName && r.bucket_start_ms >= start && r.bucket_start_ms < end) as T[]
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

describe('WF5 API transport rail', () => {
  it('creates request then loads decision-room + evidence', async () => {
    const env = makeEnv()

    const createReq = new Request('http://local/workflow/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'wf-api-1',
        principalId: 'p1',
        agentId: 'a1',
        actionType: 'payment',
        payloadRef: 'amount:20',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 20, policyVersion: 'pv1', trustSnapshotId: 'ts1' }
      })
    })

    const createRes = await app.fetch(createReq, env)
    expect(createRes.status).toBe(200)
    const created: any = await createRes.json()
    expect(created.requestId).toBe('wf-api-1')
    expect(['allow', 'deny', 'escalate']).toContain(created.decision)

    const roomRes = await app.fetch(new Request('http://local/workflow/decision-room/wf-api-1'), env)
    expect(roomRes.status).toBe(200)
    const room: any = await roomRes.json()
    expect(room.requestId).toBe('wf-api-1')
    expect(room.artifact).toBeDefined()

    const evRes = await app.fetch(new Request('http://local/workflow/evidence/wf-api-1'), env)
    expect(evRes.status).toBe(200)
    const evidence: any[] = await evRes.json()
    expect(Array.isArray(evidence)).toBe(true)
    expect(evidence.length).toBeGreaterThan(0)
  })



  it('maps FE escalate action to backend validation failure', async () => {
    const env = makeEnv()

    const createReq = new Request('http://local/workflow/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'wf-api-3',
        principalId: 'p1',
        agentId: 'a1',
        actionType: 'payment',
        payloadRef: 'amount:500',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 500 }
      })
    })

    const createdRes = await app.fetch(createReq, env)
    const created: any = await createdRes.json()
    expect(created.decision).toBe('escalate')

    const actionRes = await app.fetch(new Request('http://local/workflow/decision-room/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: created.requestId,
        hitlRequestId: created.hitlRequestId,
        action: 'escalate'
      })
    }), env)

    expect(actionRes.status).toBe(400)
    const body: any = await actionRes.json()
    expect(body.reasonCode).toBe('trust_context_invalid_request_shape')
    expect(body.error).toBe('trust_context_invalid_request_shape')
  })

  it('maps FE deny action to backend reject semantics', async () => {
    const env = makeEnv()

    const createReq = new Request('http://local/workflow/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'wf-api-2',
        principalId: 'p1',
        agentId: 'a1',
        actionType: 'payment',
        payloadRef: 'amount:500',
        timestamp: Date.now(),
        privilegedPath: true,
        context: { amount: 500 }
      })
    })

    const createdRes = await app.fetch(createReq, env)
    const created: any = await createdRes.json()
    expect(created.decision).toBe('escalate')

    const actionRes = await app.fetch(new Request('http://local/workflow/decision-room/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer principal:p1' },
      body: JSON.stringify({
        requestId: created.requestId,
        hitlRequestId: created.hitlRequestId,
        action: 'deny'
      })
    }), env)

    expect(actionRes.status).toBe(200)
    const actionOut: any = await actionRes.json()
    expect(actionOut.status).toBe('ok')
    expect(actionOut.reasonCode).toBe('hitl_rejected')
    expect(actionOut.decision).toBe('deny')
  })
})
