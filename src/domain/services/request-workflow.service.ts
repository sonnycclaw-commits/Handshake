import { evaluatePolicy } from './policy-evaluator'
import { assertKnownReasonCode, toResponseClass } from '../constants/reason-codes'
import { decisionContextHash } from './request-workflow-context'
import { validateInput } from './request-workflow-validation'
import type { RequestDecision, RequestState, RequestInput, RequestResult, RequestRecord, DecisionArtifact } from './request-workflow-types'
import { DEFAULT_POLICY } from './request-workflow-types'
import { toStoredRecord, toLegacyRecord } from './request-workflow-persistence'
import { applyEscalationGuard } from './request-workflow-escalation'
import { resolveTimeoutBranch, resolveRejectBranch, resolveApproveBranch } from './request-workflow-hitl-resolution'
import type { RequestWorkflowDeps, RequestWorkflowService } from './request-workflow.service.types'

export function createRequestWorkflowService(deps: RequestWorkflowDeps): RequestWorkflowService {
  const { requestStore, hitl, metrics, clock } = deps

  function nowMs(): number {
    return clock.nowMs()
  }

  function makeResult(input: RequestInput, decision: RequestDecision, reasonCode: string, tier: number, extras?: Partial<RequestResult>): RequestResult {
    assertKnownReasonCode(reasonCode)
    return {
      requestId: input.requestId,
      decision,
      reasonCode,
      tier,
      timestamp: nowMs(),
      decisionContextHash: decisionContextHash(input),
      responseClass: toResponseClass({ decision, reasonCode }),
      ...extras,
    }
  }

  function deny(input: RequestInput, reasonCode: string, tier = 4): RequestResult {
    return makeResult(input, 'deny', reasonCode, tier)
  }

  function allow(input: RequestInput, reasonCode = 'policy_allow', tier = 1): RequestResult {
    return makeResult(input, 'allow', reasonCode, tier, { txnId: `txn_${input.requestId}` })
  }

  async function appendLineage(requestId: string, event: Record<string, unknown>): Promise<void> {
    await requestStore.appendLineage(requestId, event)
  }

  async function classifySensitiveBranch(input: RequestInput): Promise<RequestResult | null> {
    if (input.actionType !== 'data_access') return null
    const ctx = input.context ?? {}
    const sensitivity = String((ctx.sensitivity as string | undefined) ?? '').toLowerCase()
    const authorized = Boolean((ctx.authorizedSensitiveScope as boolean | undefined) ?? false)

    if (!authorized && (sensitivity === 'high' || sensitivity === 'confidential')) {
      return deny(input, 'policy_sensitive_scope_denied', 4)
    }

    if (sensitivity === 'ambiguous') {
      const hitlReq = await hitl.create({
        agentId: input.agentId,
        principalId: input.principalId,
        tier: 3,
        action: input.actionType,
      })

      return makeResult(input, 'escalate', 'hitl_sensitive_ambiguous_escalated', 3, {
        hitlRequestId: hitlReq.id,
      })
    }

    return null
  }

  async function paymentDecision(input: RequestInput): Promise<RequestResult> {
    const ctx = input.context ?? {}
    const amount = Number((ctx.amount as number | undefined) ?? 0)
    const category = (ctx.category as string | undefined) ?? 'ops'
    const hour = Number((ctx.hour as number | undefined) ?? new Date(input.timestamp).getUTCHours())

    const decision = evaluatePolicy(
      {
        maxTransaction: Number((ctx.maxTransaction as number | undefined) ?? DEFAULT_POLICY.maxTransaction),
        dailySpendLimit: Number((ctx.dailySpendLimit as number | undefined) ?? DEFAULT_POLICY.dailySpendLimit),
        allowedHours: String((ctx.allowedHours as string | undefined) ?? DEFAULT_POLICY.allowedHours),
        allowedCategories: Array.isArray(ctx.allowedCategories) ? (ctx.allowedCategories as string[]) : DEFAULT_POLICY.allowedCategories,
      },
      { amount, category, hour }
    )

    if (decision.decision === 'deny') {
      const rawReason = `policy_${decision.reasons[0] ?? 'denied'}`
      const knownPolicyReasons = new Set(['policy_invalid_policy','policy_invalid_request','policy_daily_limit_exceeded','policy_category_not_allowed','policy_outside_allowed_hours','policy_max_transaction_exceeded','policy_denied'])
      const reason = knownPolicyReasons.has(rawReason) ? rawReason : 'policy_denied'
      return deny(input, reason, decision.tier)
    }

    if (decision.requiresHITL) {
      const hitlReq = await hitl.create({
        agentId: input.agentId,
        principalId: input.principalId,
        tier: decision.tier,
        action: input.actionType,
      })

      return makeResult(input, 'escalate', 'hitl_boundary_escalated', decision.tier, {
        hitlRequestId: hitlReq.id,
      })
    }

    return allow(input, 'policy_allow', decision.tier)
  }

  async function persist(input: RequestInput, result: RequestResult): Promise<RequestResult> {
    const stored = toStoredRecord(input, result)

    await requestStore.saveRequest(stored)

    const event = {
      event: 'request_submitted',
      state: stored.state,
      decision: result.decision,
      reasonCode: result.reasonCode,
      tier: result.tier,
      hitlRequestId: result.hitlRequestId,
      decisionContextHash: result.decisionContextHash,
      timestamp: result.timestamp,
    }

    await requestStore.appendAudit(input.requestId, event)

    if (result.decision === 'allow') await metrics.incr('wf5_decision_allow_total')
    if (result.decision === 'deny') await metrics.incr('wf5_decision_deny_total', 1, { reason: result.reasonCode })
    if (result.decision === 'escalate') await metrics.incr('wf5_decision_escalate_total')

    if (stored.terminal) {
      await appendLineage(input.requestId, {
        event: 'request_terminal',
        state: stored.state,
        decision: result.decision,
        reasonCode: result.reasonCode,
        timestamp: result.timestamp,
        decisionContextHash: result.decisionContextHash,
      })
    }

    return result
  }

  async function submitRequest(input: RequestInput): Promise<RequestResult> {
    await metrics.incr('wf5_requests_total')
    const validationError = validateInput(input, nowMs)
    if (validationError) {
      if (validationError.includes('bypass')) await metrics.incr('wf5_bypass_denied_total')
      return persist(input, deny(input, validationError, 4))
    }

    const existingPersisted = await requestStore.getRequest(input.requestId)
    if (existingPersisted) {
      return existingPersisted.result
    }

    const sensitiveBranch = await classifySensitiveBranch(input)
    if (sensitiveBranch) {
      return persist(input, await applyEscalationGuard({ input, result: sensitiveBranch, store: requestStore, nowMs, deny, incrMetric: (metric: string) => metrics.incr(metric) }))
    }

    if (input.actionType === 'payment') {
      return persist(input, await applyEscalationGuard({ input, result: await paymentDecision(input), store: requestStore, nowMs, deny, incrMetric: (metric: string) => metrics.incr(metric) }))
    }

    return persist(input, allow(input, 'policy_allow', 1))
  }

  async function resolveRequestHitl(input: {
    requestId: string
    hitlRequestId: string
    decision: 'approve' | 'reject' | 'timeout'
    timestamp: number
    approverId?: string
  }): Promise<RequestResult> {
    let record: RequestRecord | undefined
    const persisted = await requestStore.getRequest(input.requestId)
    if (persisted) {
      record = toLegacyRecord(persisted)
    }

    if (!record) {
      const syntheticInput: RequestInput = {
        requestId: input.requestId,
        principalId: 'unknown',
        agentId: 'unknown',
        actionType: 'other',
        payloadRef: 'unknown',
        timestamp: input.timestamp,
        privilegedPath: true,
      }
      return deny(syntheticInput, 'hitl_request_not_found', 4)
    }

    if (!record.hitlRequestId || record.hitlRequestId !== input.hitlRequestId) {
      const out = deny(record.input, 'hitl_request_mismatch', 4)
      const event = {
        event: 'hitl_resolution_rejected',
        reasonCode: out.reasonCode,
        timestamp: out.timestamp,
      }
      await requestStore.appendAudit(record.input.requestId, event)
      await appendLineage(record.input.requestId, { ...event, event: 'request_terminal' })
      return out
    }

    if (record.terminal) {
      await metrics.incr('wf5_terminal_mutation_denied_total')
      const out = deny(record.input, 'hitl_terminal_state_immutable', 4)
      const event = {
        event: 'hitl_late_resolution_denied',
        reasonCode: out.reasonCode,
        timestamp: out.timestamp,
      }
      await requestStore.appendAudit(record.input.requestId, event)
      await appendLineage(record.input.requestId, { ...event, event: 'request_terminal' })
      return out
    }

    if (input.decision === 'timeout') {
      const next = await resolveTimeoutBranch(record, input, {
        workflowStore: requestStore,
        timeoutHITL: (id, now) => hitl.timeout(id, now),
        rejectHITL: (id, meta) => hitl.reject(id, meta),
        approveHITL: (id, meta) => hitl.approve(id, meta),
        appendLineage,
        incrWF5Metric: (metric: string) => metrics.incr(metric),
        deny,
        allow,
      })
      return next.result
    }

    if (input.decision === 'reject') {
      const next = await resolveRejectBranch(record, {
        workflowStore: requestStore,
        timeoutHITL: (id, now) => hitl.timeout(id, now),
        rejectHITL: (id, meta) => hitl.reject(id, meta),
        approveHITL: (id, meta) => hitl.approve(id, meta),
        appendLineage,
        incrWF5Metric: (metric: string) => metrics.incr(metric),
        deny,
        allow,
      })
      return next.result
    }

    const next = await resolveApproveBranch(record, {
      workflowStore: requestStore,
      timeoutHITL: (id, now) => hitl.timeout(id, now),
      rejectHITL: (id, meta) => hitl.reject(id, meta),
      approveHITL: (id, meta) => hitl.approve(id, meta),
      appendLineage,
      incrWF5Metric: (metric: string) => metrics.incr(metric),
      deny,
      allow,
    }, input.approverId)
    return next.result
  }

  async function authorizePrivilegedExecution(input: {
    request: RequestInput
    artifact?: DecisionArtifact | null
  }): Promise<{ allowed: boolean; reasonCode: string }> {
    const artifact = input.artifact
    if (!artifact) {
      await metrics.incr('wf5_artifact_gate_denied_total', 1, { reason: 'security_missing_decision_artifact' })
      return { allowed: false, reasonCode: 'security_missing_decision_artifact' }
    }

    if (artifact.decision !== 'allow') {
      await metrics.incr('wf5_artifact_gate_denied_total', 1, { reason: 'security_non_allow_artifact' })
      return { allowed: false, reasonCode: 'security_non_allow_artifact' }
    }

    const expectedHash = decisionContextHash(input.request)
    if (artifact.decisionContextHash !== expectedHash) {
      await metrics.incr('wf5_artifact_gate_denied_total', 1, { reason: 'security_decision_context_mismatch' })
      return { allowed: false, reasonCode: 'security_decision_context_mismatch' }
    }

    let record: RequestRecord | undefined
    const persisted = await requestStore.getRequest(artifact.requestId)
    if (persisted) {
      record = toLegacyRecord(persisted)
    }

    if (!record) {
      await metrics.incr('wf5_artifact_gate_denied_total', 1, { reason: 'security_artifact_request_not_found' })
      return { allowed: false, reasonCode: 'security_artifact_request_not_found' }
    }

    const allowedStates: RequestState[] = ['allowed_terminal', 'escalated_approved_terminal']
    if (!allowedStates.includes(record.state)) {
      await metrics.incr('wf5_artifact_gate_denied_total', 1, { reason: 'security_artifact_state_not_authorized' })
      return { allowed: false, reasonCode: 'security_artifact_state_not_authorized' }
    }

    await metrics.incr('wf5_artifact_gate_allowed_total')
    return { allowed: true, reasonCode: 'security_artifact_authorized' }
  }

  async function getRequestLineage(requestId: string): Promise<Array<Record<string, unknown>>> {
    return requestStore.getLineage(requestId)
  }

  async function getRequestAudit(requestId: string): Promise<Array<Record<string, unknown>>> {
    return requestStore.getAudit(requestId)
  }

  return {
    submitRequest,
    resolveRequestHitl,
    authorizePrivilegedExecution,
    getRequestLineage,
    getRequestAudit,
  }
}
