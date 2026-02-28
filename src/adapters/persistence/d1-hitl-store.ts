import type { HITLStore, HITLStoredRequest } from '../../ports/hitl-store'

type HITLRow = {
  id: string
  agent_id: string
  principal_id: string
  tier: number
  action: string
  status: 'pending' | 'approved' | 'rejected'
  reason: string | null
  approver_id: string | null
  created_at: number
  expires_at: number
}

export class D1HITLStore implements HITLStore {
  constructor(private readonly db: D1Database) {}

  async save(request: HITLStoredRequest): Promise<void> {
    await this.db.prepare(`
      INSERT INTO request_workflow_hitl_requests (
        id, agent_id, principal_id, tier, action, status, reason, approver_id, created_at, expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        agent_id = excluded.agent_id,
        principal_id = excluded.principal_id,
        tier = excluded.tier,
        action = excluded.action,
        status = excluded.status,
        reason = excluded.reason,
        approver_id = excluded.approver_id,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      request.id,
      request.agentId,
      request.principalId,
      request.tier,
      request.action,
      request.status,
      request.reason ?? null,
      request.approverId ?? null,
      request.createdAt,
      request.expiresAt
    ).run()
  }

  async get(id: string): Promise<HITLStoredRequest | null> {
    const row = await this.db.prepare(
      `SELECT * FROM request_workflow_hitl_requests WHERE id = ?`
    ).bind(id).first<HITLRow>()

    if (!row) return null
    return {
      id: row.id,
      agentId: row.agent_id,
      principalId: row.principal_id,
      tier: row.tier,
      action: row.action,
      status: row.status,
      reason: row.reason ?? undefined,
      approverId: row.approver_id ?? undefined,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }
  }
}
