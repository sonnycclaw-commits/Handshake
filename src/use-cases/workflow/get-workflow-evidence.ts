import { authorizeWorkflowReadAccess } from './authorize-workflow-read-access'
import type { RequestWorkflowService } from '../../domain/services/request-workflow.service.types'
import { D1RequestWorkflowStore } from '../../adapters/persistence/d1-request-workflow-store'
import { statusForReasonCode, toStructuredError } from '../../core/workflow'
import { incrWF5Metric } from '../../domain/services/wf5-ops-metrics'

export async function getWorkflowEvidenceUseCase(input: {
  service: RequestWorkflowService
  env: { DB: D1Database }
  requestId: string
  identityEnvelope: { principalId: string; scopes?: string[]; tenantId?: string }
}) {
  const store = new D1RequestWorkflowStore(input.env.DB)
  const record = await store.getRequest(input.requestId)
  if (!record) {
    const reasonCode = 'hitl_request_not_found'
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'Request not found') }
  }

  const authz = authorizeWorkflowReadAccess({ identity: input.identityEnvelope, record: { principalId: record.principalId, tenantId: (record as any).tenantId } })
  if (!authz.allowed) {
    const reasonCode = authz.reasonCode
    await incrWF5Metric('wf5_security_denial_total', 1, { reason: reasonCode, endpoint: 'workflow_get_evidence', class: 'read_authz' })
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'Read access denied') }
  }

  const [audit, lineage] = await Promise.all([
    input.service.getRequestAudit(input.requestId),
    input.service.getRequestLineage(input.requestId),
  ])

  const events = [
    ...audit.map((event, idx) => ({ id: `audit_${idx}`, requestId: input.requestId, source: 'audit' as const, event })),
    ...lineage.map((event, idx) => ({ id: `lineage_${idx}`, requestId: input.requestId, source: 'lineage' as const, event })),
  ]
    .map((row) => ({
      id: row.id,
      requestId: row.requestId,
      timestamp: Number((row.event as any).timestamp ?? 0),
      reasonCode: String((row.event as any).reasonCode ?? 'unknown'),
      payload: {
        source: row.source,
        ...(row.event as Record<string, unknown>),
      },
    }))
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))

  return { ok: true as const, status: 200 as const, body: events }
}
