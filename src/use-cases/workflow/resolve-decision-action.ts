import { D1RequestWorkflowStore } from '../../adapters/persistence/d1-request-workflow-store'
import { createReplayGuard } from '../../core/replay-guard'
import { statusForReasonCode, toStructuredError, isRecord } from '../../core/workflow'
import type { RequestWorkflowService } from '../../domain/services/request-workflow.service.types'
import type { AppEnv } from '../../core/types'

export async function resolveDecisionActionUseCase(input: {
  service: RequestWorkflowService

  env: AppEnv['Bindings']
  bodyRaw: unknown
  idemKey?: string
  identityEnvelope?: { principalId?: string; subjectType?: string }
}) {
  const { env, idemKey, identityEnvelope } = input

  if (idemKey) {
    const replayGuard = createReplayGuard(env)
    const replay = await replayGuard.reserve({
      scope: 'workflow_idempotency',
      key: idemKey,
      ttlSeconds: 300,
      nowMs: Date.now(),
    })

    if (!replay.ok) {
      if (replay.reason === 'replay_detected') {
        const reasonCode = 'security_replay_detected'
        return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'Idempotency key replay detected') }
      }
      const reasonCode = 'security_replay_guard_unavailable'
      return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'Replay guard unavailable') }
    }
  }

  const body = input.bodyRaw
  if (!isRecord(body)) {
    const reasonCode = 'trust_context_invalid_request_shape'
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'Request body must be an object') }
  }

  const requestId = String(body.requestId ?? '')
  const actionRaw = String(body.action ?? '').toLowerCase()
  const mappedAction = actionRaw === 'deny' ? 'reject' : actionRaw

  if (!requestId) {
    const reasonCode = 'trust_context_missing_binding'
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'requestId is required') }
  }

  if (mappedAction !== 'approve' && mappedAction !== 'reject') {
    const reasonCode = 'trust_context_invalid_request_shape'
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'action must be approve|reject') }
  }

  const store = new D1RequestWorkflowStore(env.DB)
  const existing = await store.getRequest(requestId)
  const hitlRequestId = String(body.hitlRequestId ?? existing?.hitlRequestId ?? '')

  if (!hitlRequestId) {
    const reasonCode = 'hitl_request_not_found'
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'No HITL request is associated with this request') }
  }

  if (!identityEnvelope) {
    const reasonCode = 'security_missing_identity_envelope'
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'Identity envelope required') }
  }

  if (mappedAction === 'approve' && identityEnvelope.subjectType !== 'human') {
    const reasonCode = 'security_identity_subject_mismatch'
    return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'Approve action requires human subject') }
  }

  let approverId: string | undefined
  if (mappedAction === 'approve') {
    approverId = String(identityEnvelope.principalId ?? '').trim()
    if (!approverId) {
      const reasonCode = 'security_invalid_identity_envelope'
      return { ok: false as const, status: statusForReasonCode(reasonCode), body: toStructuredError(reasonCode, 'Identity envelope principalId is required') }
    }
  }

  const result = await input.service.resolveRequestHitl({
    requestId,
    hitlRequestId,
    decision: mappedAction,
    timestamp: Date.now(),
    approverId,
  })

  const actionSucceeded =
    (mappedAction === 'approve' && result.reasonCode === 'hitl_approved') ||
    (mappedAction === 'reject' && result.reasonCode === 'hitl_rejected')

  if (!actionSucceeded) {
    return {
      ok: false as const,
      status: statusForReasonCode(result.reasonCode),
      body: {
        ...toStructuredError(result.reasonCode, 'Decision action rejected by workflow invariants'),
        requestId: result.requestId,
        decision: result.decision,
        artifact: result,
      },
    }
  }

  return {
    ok: true as const,
    status: 200 as const,
    body: {
      status: 'ok',
      requestId: result.requestId,
      decision: result.decision,
      reasonCode: result.reasonCode,
      artifact: result,
    },
  }
}
