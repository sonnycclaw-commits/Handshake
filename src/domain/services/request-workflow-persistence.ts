import type { StoredRequestRecord } from '../../ports/request-workflow-store'
import type { RequestInput, RequestRecord, RequestResult, RequestState } from './request-workflow-types'

export function toStoredRecord(input: RequestInput, result: RequestResult): StoredRequestRecord {
  const state: RequestState =
    result.decision === 'allow' ? 'allowed_terminal'
      : result.decision === 'deny' ? 'denied_terminal'
        : 'escalated_pending'

  return {
    requestId: input.requestId,
    principalId: input.principalId,
    tenantId: input.tenantId,
    agentId: input.agentId,
    actionType: input.actionType,
    payloadRef: input.payloadRef,
    requestTimestamp: input.timestamp,
    state,
    terminal: state !== 'escalated_pending',
    decisionContextHash: result.decisionContextHash,
    hitlRequestId: result.hitlRequestId,
    result,
  }
}

export function toLegacyRecord(stored: StoredRequestRecord, inputFallback?: RequestInput): RequestRecord {
  const input: RequestInput = inputFallback ?? {
    requestId: stored.requestId,
    principalId: stored.principalId,
    tenantId: stored.tenantId,
    agentId: stored.agentId,
    actionType: stored.actionType,
    payloadRef: stored.payloadRef,
    timestamp: stored.requestTimestamp,
    privilegedPath: true,
  }

  return {
    input,
    state: stored.state,
    result: stored.result,
    hitlRequestId: stored.hitlRequestId,
    terminal: stored.terminal,
    decisionContextHash: stored.decisionContextHash,
  }
}
