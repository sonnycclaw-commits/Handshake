import { authorizeWorkflowReadAccess } from './authorize-workflow-read-access'
import { D1RequestWorkflowStore } from '../../adapters/persistence/d1-request-workflow-store'
import { statusForReasonCode, toStructuredError } from '../../core/workflow'
import { incrWF5Metric } from '../../domain/services/wf5-ops-metrics'

export async function getWorkflowRequestUseCase(input: { env: { DB: D1Database }; requestId: string; identityEnvelope: { principalId: string; scopes?: string[]; tenantId?: string } }) {
  const store = new D1RequestWorkflowStore(input.env.DB)
  const record = await store.getRequest(input.requestId)
  if (!record) {
    const reasonCode = 'hitl_request_not_found'
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'Request not found') }
  }

  const authz = authorizeWorkflowReadAccess({ identity: input.identityEnvelope, record: { principalId: record.principalId, tenantId: (record as any).tenantId } })
  if (!authz.allowed) {
    const reasonCode = authz.reasonCode
    await incrWF5Metric('wf5_security_denial_total', 1, { reason: reasonCode, endpoint: 'workflow_get_request', class: 'read_authz' })
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'Read access denied') }
  }

  return {
    ok: true as const,
    status: 200 as const,
    body: {
      requestId: record.requestId,
      principalId: record.principalId,
      agentId: record.agentId,
      actionType: record.actionType,
      payloadRef: record.payloadRef,
      state: record.state,
      terminal: record.terminal,
      decisionContextHash: record.decisionContextHash,
      artifact: record.result,
      hitlRequestId: record.hitlRequestId,
    },
  }
}
