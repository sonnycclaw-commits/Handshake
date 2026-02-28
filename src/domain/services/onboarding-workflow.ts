export type OnboardingPolicyTier = 'low' | 'medium' | 'high'
export type OnboardingDecision = 'allow' | 'deny' | 'escalate'

export interface OnboardingSession {
  sessionId: string
  principalId: string
  agentId: string
  status:
    | 'started'
    | 'identity_linked'
    | 'agent_bound'
    | 'policy_selected'
    | 'guided_run_started'
    | 'trust_proof_shown'
    | 'revoke_tested'
    | 'completed'
    | 'blocked'
  createdAt: number
}

export interface ActionEvaluationResult {
  decision: OnboardingDecision
  reasonCode: string
  tier: 0 | 1 | 2 | 3 | 4
  txnId?: string
  hitlRequestId?: string
}

export interface AuditEvent {
  event:
    | 'onboarding_started'
    | 'identity_linked'
    | 'agent_bound'
    | 'policy_selected'
    | 'action_attempted'
    | 'action_allowed'
    | 'action_denied'
    | 'action_escalated'
    | 'hitl_approved'
    | 'hitl_rejected'
    | 'hitl_expired'
    | 'trust_proof_rendered'
    | 'revoke_tested'
    | 'onboarding_completed'
  principalId: string
  agentId: string
  workflowId: string
  policyId: string
  tier: number
  reasonCode: string
  latencyMs: number
  timestamp: number
}

export interface OnboardingPolicyEnvelope {
  schemaVersion: 'onboarding-policy-envelope/v1'
  sessionId: string
  principalId: string
  agentId: string
  policyId: string
  tier: OnboardingPolicyTier
  scope: string[]
  limits: {
    maxTransaction: number
    dailySpendLimit: number
  }
  expiryTs: number
}

type InternalSession = OnboardingSession & {
  policyId?: string
  policyTier?: OnboardingPolicyTier
  revoked: boolean
  firstTrustProofAt?: number
}

type Hitl = {
  id: string
  sessionId: string
  createdAt: number
  status: 'pending' | 'approved' | 'rejected' | 'expired'
}

const sessions = new Map<string, InternalSession>()
const audits = new Map<string, AuditEvent[]>()
const hitls = new Map<string, Hitl>()

let seq = 0
const nextId = (p: string) => `${p}_${++seq}`

function pushAudit(
  s: InternalSession,
  event: AuditEvent['event'],
  reasonCode: string,
  tier: number,
  timestamp: number,
  latencyMs = 0
) {
  const arr = audits.get(s.sessionId) || []
  arr.push({
    event,
    principalId: s.principalId,
    agentId: s.agentId,
    workflowId: s.sessionId,
    policyId: s.policyId || 'unselected',
    tier,
    reasonCode,
    latencyMs,
    timestamp,
  })
  audits.set(s.sessionId, arr)
}

function markTrustProofIfMissing(s: InternalSession, now: number) {
  if (s.firstTrustProofAt == null) {
    s.firstTrustProofAt = now
    s.status = 'trust_proof_shown'
    pushAudit(s, 'trust_proof_rendered', 'trust_proof_rendered', 0, now)
  }
}

function getSessionOrThrow(sessionId: string): InternalSession {
  const s = sessions.get(sessionId)
  if (!s) throw new Error('SESSION_NOT_FOUND')
  return s
}

function classifyActionTier(policyTier: OnboardingPolicyTier, action: { kind: string; amount?: number }): 0 | 1 | 2 | 3 | 4 {
  if (action.kind !== 'payment') return 0
  const amount = action.amount ?? 0
  if (policyTier === 'low') {
    if (amount <= 30) return 1
    if (amount <= 100) return 3
    return 4
  }
  if (policyTier === 'medium') {
    if (amount <= 50) return 2
    if (amount <= 200) return 3
    return 4
  }
  if (amount <= 20) return 2
  if (amount <= 100) return 3
  return 4
}

function limitsForTier(tier: OnboardingPolicyTier) {
  if (tier === 'low') return { maxTransaction: 30, dailySpendLimit: 100 }
  if (tier === 'medium') return { maxTransaction: 50, dailySpendLimit: 250 }
  return { maxTransaction: 20, dailySpendLimit: 80 }
}

export function startOnboardingSession(input: { principalId: string; agentId: string; now: number }): OnboardingSession {
  const sessionId = nextId('onb')
  const s: InternalSession = {
    sessionId,
    principalId: input.principalId,
    agentId: input.agentId,
    status: 'started',
    createdAt: input.now,
    revoked: false,
  }
  sessions.set(sessionId, s)
  pushAudit(s, 'onboarding_started', 'onboarding_started', 0, input.now)
  pushAudit(s, 'identity_linked', 'identity_linked', 0, input.now)
  s.status = 'identity_linked'
  pushAudit(s, 'agent_bound', 'agent_bound', 0, input.now)
  s.status = 'agent_bound'
  return s
}

export function selectOnboardingPolicy(input: {
  sessionId: string
  policyId: string
  tier: OnboardingPolicyTier
  now: number
}): OnboardingSession {
  const s = getSessionOrThrow(input.sessionId)
  s.policyId = input.policyId
  s.policyTier = input.tier
  s.status = 'policy_selected'
  pushAudit(s, 'policy_selected', `policy_selected:${input.tier}`, 0, input.now)
  return s
}

export function evaluateGuidedAction(input: {
  sessionId: string
  action: { kind: string; amount?: number; category?: string }
  context: { hour: number; privilegedPath: boolean; revoked?: boolean }
  now: number
}): ActionEvaluationResult {
  const s = getSessionOrThrow(input.sessionId)
  if (!s.policyTier || !s.policyId) {
    const result: ActionEvaluationResult = { decision: 'deny', reasonCode: 'policy_not_selected', tier: 4 }
    pushAudit(s, 'action_denied', result.reasonCode, result.tier, input.now)
    markTrustProofIfMissing(s, input.now)
    return result
  }

  s.status = 'guided_run_started'
  pushAudit(s, 'action_attempted', 'action_attempted', 0, input.now)

  // semantic bypass guard: non-payment action should not carry payment payload
  if (input.action.kind !== 'payment' && (input.action.amount !== undefined || input.action.category !== undefined)) {
    const result: ActionEvaluationResult = { decision: 'deny', reasonCode: 'malformed_action_shape', tier: 4 }
    pushAudit(s, 'action_denied', result.reasonCode, result.tier, input.now)
    markTrustProofIfMissing(s, input.now)
    return result
  }

  if (!input.context.privilegedPath) {
    const result: ActionEvaluationResult = { decision: 'deny', reasonCode: 'handshake_required_bypass_denied', tier: 4 }
    pushAudit(s, 'action_denied', result.reasonCode, result.tier, input.now)
    markTrustProofIfMissing(s, input.now)
    return result
  }

  if (s.revoked || input.context.revoked) {
    const result: ActionEvaluationResult = { decision: 'deny', reasonCode: 'revoked_principal_control', tier: 4 }
    pushAudit(s, 'action_denied', result.reasonCode, result.tier, input.now)
    markTrustProofIfMissing(s, input.now)
    return result
  }

  const tier = classifyActionTier(s.policyTier, input.action)
  if (tier >= 3) {
    const hitlId = nextId('hitl')
    hitls.set(hitlId, { id: hitlId, sessionId: s.sessionId, createdAt: input.now, status: 'pending' })
    const result: ActionEvaluationResult = {
      decision: 'escalate',
      reasonCode: 'boundary_escalation_required',
      tier,
      hitlRequestId: hitlId,
    }
    pushAudit(s, 'action_escalated', result.reasonCode, tier, input.now)
    markTrustProofIfMissing(s, input.now)
    return result
  }

  const result: ActionEvaluationResult = {
    decision: 'allow',
    reasonCode: 'policy_allow_within_bounds',
    tier,
    txnId: nextId('txn'),
  }
  pushAudit(s, 'action_allowed', result.reasonCode, tier, input.now)
  markTrustProofIfMissing(s, input.now)
  return result
}

export function resolveOnboardingHitl(input: {
  sessionId: string
  hitlRequestId: string
  decision: 'approve' | 'reject' | 'timeout'
  now: number
}): ActionEvaluationResult {
  const s = getSessionOrThrow(input.sessionId)
  const h = hitls.get(input.hitlRequestId)

  if (!h || h.sessionId !== s.sessionId) {
    const result: ActionEvaluationResult = { decision: 'deny', reasonCode: 'hitl_request_not_found', tier: 4 }
    pushAudit(s, 'action_denied', result.reasonCode, result.tier, input.now)
    markTrustProofIfMissing(s, input.now)
    return result
  }

  if (h.status !== 'pending') {
    const result: ActionEvaluationResult = { decision: 'deny', reasonCode: `hitl_terminal_state_${h.status}`, tier: 4 }
    pushAudit(s, 'action_denied', result.reasonCode, result.tier, input.now)
    markTrustProofIfMissing(s, input.now)
    return result
  }

  if (input.decision === 'timeout') {
    h.status = 'expired'
    const result: ActionEvaluationResult = { decision: 'deny', reasonCode: 'hitl_timeout_fail_closed', tier: 4 }
    pushAudit(s, 'hitl_expired', result.reasonCode, result.tier, input.now)
    pushAudit(s, 'action_denied', result.reasonCode, result.tier, input.now)
    markTrustProofIfMissing(s, input.now)
    return result
  }

  if (input.decision === 'reject') {
    h.status = 'rejected'
    const result: ActionEvaluationResult = { decision: 'deny', reasonCode: 'hitl_rejected', tier: 4 }
    pushAudit(s, 'hitl_rejected', result.reasonCode, result.tier, input.now)
    pushAudit(s, 'action_denied', result.reasonCode, result.tier, input.now)
    markTrustProofIfMissing(s, input.now)
    return result
  }

  h.status = 'approved'
  const result: ActionEvaluationResult = {
    decision: 'allow',
    reasonCode: 'hitl_approved',
    tier: 3,
    txnId: nextId('txn'),
  }
  pushAudit(s, 'hitl_approved', result.reasonCode, result.tier, input.now)
  pushAudit(s, 'action_allowed', result.reasonCode, result.tier, input.now)
  markTrustProofIfMissing(s, input.now)
  return result
}

export function revokeOnboarding(input: { sessionId: string; principalId: string; now: number }): { revoked: true; reasonCode: string } {
  const s = getSessionOrThrow(input.sessionId)
  if (s.principalId !== input.principalId) throw new Error('UNAUTHORIZED_PRINCIPAL')
  s.revoked = true
  s.status = 'revoke_tested'
  pushAudit(s, 'revoke_tested', 'revoked_principal_control', 4, input.now)
  return { revoked: true, reasonCode: 'revoked_principal_control' }
}

export function getOnboardingAuditEvents(sessionId: string): AuditEvent[] {
  return [...(audits.get(sessionId) || [])]
}

export function getOnboardingAuditExport(sessionId: string): AuditEvent[] {
  return getOnboardingAuditEvents(sessionId)
}

export function getOnboardingPolicyEnvelope(sessionId: string): OnboardingPolicyEnvelope {
  const s = getSessionOrThrow(sessionId)
  if (!s.policyId || !s.policyTier) throw new Error('POLICY_NOT_SELECTED')
  return {
    schemaVersion: 'onboarding-policy-envelope/v1',
    sessionId: s.sessionId,
    principalId: s.principalId,
    agentId: s.agentId,
    policyId: s.policyId,
    tier: s.policyTier,
    scope: ['transaction:request', 'policy:evaluate', 'audit:append'],
    limits: limitsForTier(s.policyTier),
    expiryTs: s.createdAt + 24 * 60 * 60 * 1000,
  }
}

export function getOnboardingProgress(sessionId: string): {
  currentStep: OnboardingSession['status']
  nextStep: OnboardingSession['status'] | 'none'
  requiresProtocolKnowledge: false
} {
  const s = getSessionOrThrow(sessionId)
  const order: OnboardingSession['status'][] = [
    'started',
    'identity_linked',
    'agent_bound',
    'policy_selected',
    'guided_run_started',
    'trust_proof_shown',
    'revoke_tested',
    'completed',
  ]
  const idx = order.indexOf(s.status)
  const nextStep = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : 'none'
  return { currentStep: s.status, nextStep, requiresProtocolKnowledge: false }
}

export function getTimeToFirstTrustProofMs(sessionId: string): number | null {
  const s = getSessionOrThrow(sessionId)
  if (s.firstTrustProofAt == null) return null
  return s.firstTrustProofAt - s.createdAt
}
