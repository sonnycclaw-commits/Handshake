import type {
  RequestWorkflowStore,
  StoredRequestRecord,
} from '../../ports/request-workflow-store'

type RequestRow = {
  request_id: string
  principal_id: string
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
        state, terminal, decision_context_hash, hitl_request_id, result_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(request_id) DO UPDATE SET
        principal_id = excluded.principal_id,
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
