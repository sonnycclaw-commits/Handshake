import { classifyReasonCode } from '../../domain/constants/reason-codes'
import { statusForReasonCode, toStructuredError, isActionType, isRecord } from '../../core/workflow'
import type { RequestInput } from '../../domain/services/request-workflow-types'
import type { RequestWorkflowService } from '../../domain/services/request-workflow.service.types'
import { D1RequestWorkflowStore } from '../../adapters/persistence/d1-request-workflow-store'

export async function submitWorkflowRequestUseCase(input: { service: RequestWorkflowService; env: { DB: D1Database }; bodyRaw: unknown }) {
  const body = input.bodyRaw
  if (!isRecord(body)) {
    const reasonCode = 'trust_context_invalid_request_shape'
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'Request body must be an object') }
  }

  if (!isActionType(body.actionType)) {
    const reasonCode = 'trust_context_invalid_request_shape'
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'actionType is invalid or missing') }
  }

  const request: RequestInput = {
    requestId: String(body.requestId ?? ''),
    principalId: String(body.principalId ?? ''),
    tenantId: typeof body.tenantId === 'string' ? String(body.tenantId) : undefined,
    agentId: String(body.agentId ?? ''),
    actionType: body.actionType,
    payloadRef: String(body.payloadRef ?? ''),
    timestamp: Number(body.timestamp ?? Date.now()),
    privilegedPath: body.privilegedPath === false ? false : true,
    context: isRecord(body.context) ? body.context : undefined,
  }

  const result = await input.service.submitRequest(request)
  const store = new D1RequestWorkflowStore(input.env.DB)
  const persisted = await store.getRequest(result.requestId)
  const state = persisted?.state ?? (result.decision === 'escalate' ? 'escalated_pending' : result.decision === 'allow' ? 'allowed_terminal' : 'denied_terminal')

  const validationOrSecurityDeny = result.decision === 'deny' && (
    classifyReasonCode(result.reasonCode) === 'trust_context' ||
    result.reasonCode === 'security_handshake_required_bypass_denied' ||
    result.reasonCode === 'security_side_channel_denied'
  )

  if (validationOrSecurityDeny) {
    return {
      ok: false as const,
      status: statusForReasonCode(result.reasonCode),
      body: {
        ...toStructuredError(result.reasonCode, 'Request denied at workflow boundary'),
        requestId: result.requestId,
        decision: result.decision,
        tier: result.tier,
        decisionContextHash: result.decisionContextHash,
        state,
      },
    }
  }

  return { ok: true as const, status: 200 as const, body: { ...result, state } }
}
