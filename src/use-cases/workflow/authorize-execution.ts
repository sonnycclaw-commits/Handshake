import type { RequestWorkflowService } from '../../domain/services/request-workflow.service.types'
import { isActionType, isRecord, statusForReasonCode, toStructuredError } from '../../core/workflow'
import { toResponseClass } from '../../domain/constants/reason-codes'
import type { RequestInput } from '../../domain/services/request-workflow-types'

export async function authorizeExecutionUseCase(input: { service: RequestWorkflowService; bodyRaw: unknown }) {
  const body = input.bodyRaw
  if (!isRecord(body) || !isRecord(body.request)) {
    const reasonCode = 'trust_context_invalid_request_shape'
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'request object is required') }
  }

  const req = body.request
  if (!isActionType(req.actionType)) {
    const reasonCode = 'trust_context_invalid_request_shape'
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'request.actionType is invalid') }
  }

  const request: RequestInput = {
    requestId: String(req.requestId ?? ''),
    principalId: String(req.principalId ?? ''),
    agentId: String(req.agentId ?? ''),
    actionType: req.actionType,
    payloadRef: String(req.payloadRef ?? ''),
    timestamp: Number(req.timestamp ?? Date.now()),
    privilegedPath: req.privilegedPath === false ? false : true,
    context: isRecord(req.context) ? req.context : undefined,
  }

  const gate = await input.service.authorizePrivilegedExecution({
    request,
    artifact: (body as Record<string, unknown>).artifact as any,
  })

  if (!gate.allowed) {
    return {
      ok: false as const,
      status: statusForReasonCode(gate.reasonCode),
      body: { ...toStructuredError(gate.reasonCode, 'Privileged execution denied'), allowed: false },
    }
  }

  return {
    ok: true as const,
    status: 200 as const,
    body: {
      status: 'ok',
      allowed: true,
      reasonCode: gate.reasonCode,
      responseClass: toResponseClass({ decision: 'allow', reasonCode: gate.reasonCode }),
    },
  }
}
