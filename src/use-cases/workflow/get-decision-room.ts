import { authorizeWorkflowReadAccess } from './authorize-workflow-read-access'
import { D1RequestWorkflowStore } from '../../adapters/persistence/d1-request-workflow-store'
import { D1HITLStore } from '../../adapters/persistence/d1-hitl-store'
import { classifyReasonCode } from '../../domain/constants/reason-codes'
import { mapTierToRiskTier, statusForReasonCode, toStructuredError } from '../../core/workflow'

export async function getDecisionRoomUseCase(input: { env: { DB: D1Database }; requestId: string; identityEnvelope: { principalId: string; scopes?: string[]; tenantId?: string } }) {
  const store = new D1RequestWorkflowStore(input.env.DB)
  const record = await store.getRequest(input.requestId)
  if (!record) {
    const reasonCode = 'hitl_request_not_found'
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'Decision context not found') }
  }

  const authz = authorizeWorkflowReadAccess({ identity: input.identityEnvelope, record: { principalId: record.principalId, tenantId: (record as any).tenantId } })
  if (!authz.allowed) {
    const reasonCode = authz.reasonCode
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'Read access denied') }
  }

  const artifact = record.result
  const riskTier = mapTierToRiskTier(artifact.tier)
  const reasonFamily = classifyReasonCode(artifact.reasonCode)

  let expiresAt: number | undefined
  if (record.hitlRequestId) {
    const hitl = await new D1HITLStore(input.env.DB).get(record.hitlRequestId)
    expiresAt = hitl?.expiresAt
  }

  return {
    ok: true as const,
    status: 200 as const,
    body: {
      requestId: record.requestId,
      agentId: record.agentId,
      principalId: record.principalId,
      riskTier,
      reasonFamily,
      artifact,
      ...(typeof expiresAt === 'number' ? { expiresAt } : {}),
    },
  }
}
