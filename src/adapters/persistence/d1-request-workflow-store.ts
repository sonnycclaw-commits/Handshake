import type {
  RequestWorkflowStore,
  StoredRequestRecord,
} from '../../ports/request-workflow-store'

type RequestRow = {
  request_id: string
  principal_id: string
  tenant_id: string | null
  agent_id: string
  action_type: 'payment' | 'data_access' | 'credential_use' | 'external_call' | 'other'
  payload_ref: string
  request_timestamp: number
  state: StoredRequestRecord['state']
  terminal: number
  decision_context_hash: string
  hitl_request_id: string | null
  result_json: string
}

type EventRow = { event_json: string }
type EscalationRow = { timestamps_json: string }

type MetricsEventRow = {
  event_id: string
  request_id: string
  timestamp_ms: number
  decision: string
  reason_code: string
  reason_family: string
  risk_tier: string
  is_terminal: number
  has_valid_lineage: number
  incident_detected_ts_ms: number | null
  terminal_decision_ts_ms: number | null
  human_minutes: number | null
  compute_cost_units: number | null
  escalation_overhead_units: number | null
  schema_version: string
  projector_version: string
}

type MetricsRollupRow = {
  bucket_start_ms: number
  metric_name: string
  dimension_key: string
  value_real: number
  sample_count: number
  schema_version: string
  projector_version: string
}

export class D1RequestWorkflowStore implements RequestWorkflowStore {
  constructor(private readonly db: D1Database) {}

  async getRequest(requestId: string): Promise<StoredRequestRecord | null> {
    const row = await this.db.prepare(
      `SELECT * FROM request_workflow_requests WHERE request_id = ?`
    ).bind(requestId).first<RequestRow>()

    if (!row) return null

    const result = JSON.parse(row.result_json) as StoredRequestRecord['result']
    return {
      requestId: row.request_id,
      principalId: row.principal_id,
      tenantId: row.tenant_id ?? undefined,
      agentId: row.agent_id,
      actionType: row.action_type,
      payloadRef: row.payload_ref,
      requestTimestamp: row.request_timestamp,
      state: row.state,
      terminal: row.terminal === 1,
      decisionContextHash: row.decision_context_hash,
      hitlRequestId: row.hitl_request_id ?? undefined,
      result,
    }
  }

  async saveRequest(record: StoredRequestRecord): Promise<void> {
    await this.db.prepare(`
      INSERT INTO request_workflow_requests (
        request_id, principal_id, agent_id, action_type, payload_ref, request_timestamp,
        state, terminal, decision_context_hash, hitl_request_id, result_json, tenant_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(request_id) DO UPDATE SET
        principal_id = excluded.principal_id,
        tenant_id = excluded.tenant_id,
        agent_id = excluded.agent_id,
        action_type = excluded.action_type,
        payload_ref = excluded.payload_ref,
        request_timestamp = excluded.request_timestamp,
        state = excluded.state,
        terminal = excluded.terminal,
        decision_context_hash = excluded.decision_context_hash,
        hitl_request_id = excluded.hitl_request_id,
        result_json = excluded.result_json,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      record.requestId,
      record.principalId,
      record.agentId,
      record.actionType,
      record.payloadRef,
      record.requestTimestamp,
      record.state,
      record.terminal ? 1 : 0,
      record.decisionContextHash,
      record.hitlRequestId ?? null,
      JSON.stringify(record.result),
      record.tenantId ?? null,
    ).run()
  }

  async appendAudit(requestId: string, event: Record<string, unknown>): Promise<void> {
    await this.db.prepare(
      `INSERT INTO request_workflow_audit_events (request_id, event_json) VALUES (?, ?)`
    ).bind(requestId, JSON.stringify(event)).run()
  }

  async getAudit(requestId: string): Promise<Array<Record<string, unknown>>> {
    const rows = await this.db.prepare(
      `SELECT event_json FROM request_workflow_audit_events WHERE request_id = ? ORDER BY id ASC`
    ).bind(requestId).all<EventRow>()

    return (rows.results ?? []).map((r) => JSON.parse(r.event_json) as Record<string, unknown>)
  }

  async appendLineage(requestId: string, event: Record<string, unknown>): Promise<void> {
    await this.db.prepare(
      `INSERT INTO request_workflow_lineage_events (request_id, event_json) VALUES (?, ?)`
    ).bind(requestId, JSON.stringify(event)).run()
  }

  async getLineage(requestId: string): Promise<Array<Record<string, unknown>>> {
    const rows = await this.db.prepare(
      `SELECT event_json FROM request_workflow_lineage_events WHERE request_id = ? ORDER BY id ASC`
    ).bind(requestId).all<EventRow>()

    return (rows.results ?? []).map((r) => JSON.parse(r.event_json) as Record<string, unknown>)
  }

  async appendMetricsEvent(event: {
    eventId: string
    requestId: string
    timestampMs: number
    decision: string
    reasonCode: string
    reasonFamily: string
    riskTier: string
    isTerminal: boolean
    hasValidLineage: boolean
    incidentDetectedTsMs?: number
    terminalDecisionTsMs?: number
    humanMinutes?: number
    computeCostUnits?: number
    escalationOverheadUnits?: number
    schemaVersion: string
    projectorVersion: string
  }): Promise<void> {
    await this.db.prepare(`
      INSERT INTO metrics_events (
        event_id, request_id, timestamp_ms, decision, reason_code, reason_family, risk_tier,
        is_terminal, has_valid_lineage, incident_detected_ts_ms, terminal_decision_ts_ms,
        human_minutes, compute_cost_units, escalation_overhead_units,
        schema_version, projector_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO NOTHING
    `).bind(
      event.eventId,
      event.requestId,
      event.timestampMs,
      event.decision,
      event.reasonCode,
      event.reasonFamily,
      event.riskTier,
      event.isTerminal ? 1 : 0,
      event.hasValidLineage ? 1 : 0,
      event.incidentDetectedTsMs ?? null,
      event.terminalDecisionTsMs ?? null,
      event.humanMinutes ?? null,
      event.computeCostUnits ?? null,
      event.escalationOverheadUnits ?? null,
      event.schemaVersion,
      event.projectorVersion,
    ).run()
  }

  async getMetricsEventsInWindow(startMs: number, endMs: number): Promise<Array<Record<string, unknown>>> {
    const rows = await this.db.prepare(`
      SELECT * FROM metrics_events
      WHERE timestamp_ms >= ? AND timestamp_ms < ?
      ORDER BY timestamp_ms ASC
    `).bind(startMs, endMs).all<MetricsEventRow>()

    return (rows.results ?? []).map((r) => ({
      eventId: r.event_id,
      requestId: r.request_id,
      timestampMs: r.timestamp_ms,
      decision: r.decision,
      reasonCode: r.reason_code,
      reasonFamily: r.reason_family,
      riskTier: r.risk_tier,
      isTerminal: r.is_terminal === 1,
      hasValidLineage: r.has_valid_lineage === 1,
      incidentDetectedTsMs: r.incident_detected_ts_ms ?? undefined,
      terminalDecisionTsMs: r.terminal_decision_ts_ms ?? undefined,
      humanMinutes: r.human_minutes ?? undefined,
      computeCostUnits: r.compute_cost_units ?? undefined,
      escalationOverheadUnits: r.escalation_overhead_units ?? undefined,
      schemaVersion: r.schema_version,
      projectorVersion: r.projector_version,
    }))
  }

  async upsertMetricsRollupHourly(row: {
    bucketStartMs: number
    metricName: string
    dimensionKey: string
    valueReal: number
    sampleCount: number
    schemaVersion: string
    projectorVersion: string
  }): Promise<void> {
    await this.db.prepare(`
      INSERT INTO metrics_rollups_hourly (
        bucket_start_ms, metric_name, dimension_key, value_real, sample_count, schema_version, projector_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(bucket_start_ms, metric_name, dimension_key) DO UPDATE SET
        value_real = excluded.value_real,
        sample_count = excluded.sample_count,
        schema_version = excluded.schema_version,
        projector_version = excluded.projector_version,
        computed_at = CURRENT_TIMESTAMP
    `).bind(
      row.bucketStartMs,
      row.metricName,
      row.dimensionKey,
      row.valueReal,
      row.sampleCount,
      row.schemaVersion,
      row.projectorVersion,
    ).run()
  }

  async upsertMetricsRollupDaily(row: {
    bucketStartMs: number
    metricName: string
    dimensionKey: string
    valueReal: number
    sampleCount: number
    schemaVersion: string
    projectorVersion: string
  }): Promise<void> {
    await this.db.prepare(`
      INSERT INTO metrics_rollups_daily (
        bucket_start_ms, metric_name, dimension_key, value_real, sample_count, schema_version, projector_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(bucket_start_ms, metric_name, dimension_key) DO UPDATE SET
        value_real = excluded.value_real,
        sample_count = excluded.sample_count,
        schema_version = excluded.schema_version,
        projector_version = excluded.projector_version,
        computed_at = CURRENT_TIMESTAMP
    `).bind(
      row.bucketStartMs,
      row.metricName,
      row.dimensionKey,
      row.valueReal,
      row.sampleCount,
      row.schemaVersion,
      row.projectorVersion,
    ).run()
  }

  async getMetricsRollups(metricName: string, bucket: 'hour' | 'day', startMs: number, endMs: number): Promise<Array<Record<string, unknown>>> {
    const table = bucket === 'hour' ? 'metrics_rollups_hourly' : 'metrics_rollups_daily'
    const rows = await this.db.prepare(`
      SELECT * FROM ${table}
      WHERE metric_name = ? AND bucket_start_ms >= ? AND bucket_start_ms < ?
      ORDER BY bucket_start_ms ASC
    `).bind(metricName, startMs, endMs).all<MetricsRollupRow>()

    return (rows.results ?? []).map((r) => ({
      bucketStartMs: r.bucket_start_ms,
      metricName: r.metric_name,
      dimensionKey: r.dimension_key,
      valueReal: r.value_real,
      sampleCount: r.sample_count,
      schemaVersion: r.schema_version,
      projectorVersion: r.projector_version,
    }))
  }

  async getEscalationHistory(key: string): Promise<number[]> {
    const row = await this.db.prepare(
      `SELECT timestamps_json FROM request_workflow_escalation_buckets WHERE bucket_key = ?`
    ).bind(key).first<EscalationRow>()

    if (!row) return []
    return JSON.parse(row.timestamps_json) as number[]
  }

  async setEscalationHistory(key: string, timestamps: number[]): Promise<void> {
    await this.db.prepare(`
      INSERT INTO request_workflow_escalation_buckets (bucket_key, timestamps_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(bucket_key) DO UPDATE SET
        timestamps_json = excluded.timestamps_json,
        updated_at = CURRENT_TIMESTAMP
    `).bind(key, JSON.stringify(timestamps)).run()
  }
}
