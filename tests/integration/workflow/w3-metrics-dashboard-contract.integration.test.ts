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
  metricsEvents: any[] = []
  metricsRollupsHourly: any[] = []
  metricsRollupsDaily: any[] = []

  prepare(sql: string) { return new FakeStmt(this, sql) }

  run(sql: string, args: unknown[]) {
    if (sql.includes('INSERT INTO metrics_events')) {
      this.metricsEvents.push({
        event_id: args[0],
        request_id: args[1],
        timestamp_ms: args[2],
        decision: args[3],
        reason_code: args[4],
        reason_family: args[5],
        risk_tier: args[6],
        is_terminal: args[7],
        has_valid_lineage: args[8],
        incident_detected_ts_ms: args[9],
        terminal_decision_ts_ms: args[10],
        human_minutes: args[11],
        compute_cost_units: args[12],
        escalation_overhead_units: args[13],
        schema_version: args[14],
        projector_version: args[15],
      })
      return
    }

    if (sql.includes('INSERT INTO metrics_rollups_hourly')) {
      this.metricsRollupsHourly.push({
        bucket_start_ms: args[0],
        metric_name: args[1],
        dimension_key: args[2],
        value_real: args[3],
        sample_count: args[4],
      })
      return
    }

    if (sql.includes('INSERT INTO metrics_rollups_daily')) {
      this.metricsRollupsDaily.push({
        bucket_start_ms: args[0],
        metric_name: args[1],
        dimension_key: args[2],
        value_real: args[3],
        sample_count: args[4],
      })
      return
    }
  }

  first<T>(_sql: string, _args: unknown[]): T | null {
    return null
  }

  all<T>(sql: string, args: unknown[]): T[] {
    if (sql.includes('FROM metrics_events')) {
      const [startMs, endMs] = args as number[]
      return this.metricsEvents
        .filter((r) => r.timestamp_ms >= startMs && r.timestamp_ms < endMs)
        .sort((a, b) => a.timestamp_ms - b.timestamp_ms) as T[]
    }

    if (sql.includes('FROM metrics_rollups_hourly') || sql.includes('FROM metrics_rollups_daily')) {
      const metricName = String(args[0])
      const startMs = Number(args[1])
      const endMs = Number(args[2])
      const rows = sql.includes('metrics_rollups_hourly') ? this.metricsRollupsHourly : this.metricsRollupsDaily
      return rows
        .filter((r) => r.metric_name === metricName && r.bucket_start_ms >= startMs && r.bucket_start_ms < endMs)
        .sort((a, b) => a.bucket_start_ms - b.bucket_start_ms) as T[]
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

describe('W3 C2 metrics dashboard/query contract', () => {
  it('returns enriched summary with denial/replay trend counters', async () => {
    const env = makeEnv()
    const now = Date.now()

    const events = [
      {
        eventId: 'm1', requestId: 'r1', timestampMs: now - 1000,
        decision: 'deny', reasonCode: 'security_read_scope_denied', reasonFamily: 'security', riskTier: 'high'
      },
      {
        eventId: 'm2', requestId: 'r2', timestampMs: now - 900,
        decision: 'deny', reasonCode: 'security_replay_detected', reasonFamily: 'security', riskTier: 'critical'
      },
      {
        eventId: 'm3', requestId: 'r3', timestampMs: now - 800,
        decision: 'deny', reasonCode: 'security_replay_guard_unavailable', reasonFamily: 'security', riskTier: 'critical'
      },
      {
        eventId: 'm4', requestId: 'r4', timestampMs: now - 700,
        decision: 'allow', reasonCode: 'policy_allow', reasonFamily: 'policy', riskTier: 'low'
      }
    ]

    for (const e of events) {
      const res = await app.fetch(new Request('http://local/metrics/project', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(e)
      }), env)
      expect(res.status).toBe(200)
    }

    const summaryRes = await app.fetch(new Request('http://local/metrics/summary?window=24h'), env)
    expect(summaryRes.status).toBe(200)
    const body: any = await summaryRes.json()

    expect(typeof body.totalEvents).toBe('number')
    expect(typeof body.denialEvents).toBe('number')
    expect(typeof body.replayDetectedEvents).toBe('number')
    expect(typeof body.replayGuardUnavailableEvents).toBe('number')

    expect(body.totalEvents).toBe(4)
    expect(body.denialEvents).toBe(3)
    expect(body.replayDetectedEvents).toBe(1)
    expect(body.replayGuardUnavailableEvents).toBe(1)
  })

  it('enforces supported metric query set for series endpoint', async () => {
    const env = makeEnv()

    const bad = await app.fetch(new Request('http://local/metrics/series?metric=not_a_real_metric&bucket=hour&window=24h'), env)
    expect(bad.status).toBe(400)
    const badBody: any = await bad.json()
    expect(badBody.error).toBe('invalid_metric_query')
    expect(badBody.responseClass).toBe('blocked')

    const good = await app.fetch(new Request('http://local/metrics/series?metric=security_denial_total&bucket=hour&window=24h'), env)
    expect(good.status).toBe(200)
    const goodBody: any = await good.json()
    expect(goodBody.metric).toBe('security_denial_total')
    expect(Array.isArray(goodBody.series)).toBe(true)
  })
})
