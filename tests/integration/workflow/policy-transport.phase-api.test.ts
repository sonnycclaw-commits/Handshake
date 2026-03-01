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
  policyActive = new Map<string, any>()
  policyVersions = new Map<string, any>()
  policyAudit = new Map<string, any>()
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

    // workflow/metrics no-op compatibility
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
    if (sql.includes('FROM policy_active_configs')) {
      const [scope, scope_id] = args
      return (this.policyActive.get(`${scope}:${scope_id}`) ?? null) as T | null
    }

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

  all<T>(_sql: string, _args: unknown[]): T[] {
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

describe('Policy rail transport', () => {
  it('simulates and applies policy then reads config', async () => {
    const env = makeEnv()

    const simulateRes = await app.fetch(new Request('http://local/policy/simulate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scope: 'global',
        rules: [
          { id: 'r1', key: 'max_payment', value: 50 },
          { id: 'r2', key: 'daily_spend_limit', value: 200 },
        ]
      })
    }), env)

    expect(simulateRes.status).toBe(200)
    const sim: any = await simulateRes.json()
    expect(sim.status).toBe('ok')
    expect(sim.blastRadius.affectedAgents).toBeGreaterThan(0)

    const applyRes = await app.fetch(new Request('http://local/policy/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scope: 'global',
        rules: [
          { id: 'r1', key: 'max_payment', value: 50 },
          { id: 'r2', key: 'daily_spend_limit', value: 200 },
        ]
      })
    }), env)

    expect(applyRes.status).toBe(200)
    const applied: any = await applyRes.json()
    expect(applied.status).toBe('ok')
    expect(typeof applied.policyVersion).toBe('string')
    expect(typeof applied.auditEventId).toBe('string')

    const configRes = await app.fetch(new Request('http://local/policy/config?scope=global'), env)
    expect(configRes.status).toBe(200)
    const cfg: any = await configRes.json()
    expect(cfg.scope).toBe('global')
    expect(Array.isArray(cfg.rules)).toBe(true)
    expect(cfg.rules.length).toBe(2)
    expect(cfg.policyVersion).toBe(applied.policyVersion)
  })

  it('fails closed on invalid policy payload', async () => {
    const env = makeEnv()

    const res = await app.fetch(new Request('http://local/policy/simulate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'agent', rules: 'not-an-array' })
    }), env)

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.status).toBe('error')
    expect(body.reasonCode).toBe('trust_context_missing_binding')
    expect(body.error).toBe('trust_context_missing_binding')
  })
})
