import {
  getQuorumRequestById,
  submitQuorumDecision,
  upsertQuorumRequest,
  type QuorumRequest
} from './quorum-hitl'
import { buildGovernanceAuditLineage } from './governance-audit-lineage'
import { governanceTransactionFailed, invalidInput, notFound } from '../errors/governance-errors'

type GovernanceDecisionInput = {
  requestId: string
  approverId: string
  decision: 'approve' | 'reject'
}

type GovernanceTransactionDeps = {
  getRequest: (requestId: string) => QuorumRequest | undefined
  submitDecision: (input: GovernanceDecisionInput) => QuorumRequest
  restoreRequest: (request: QuorumRequest) => void
  appendLineage: (input: {
    decisionId: string
    actorId: string
    action: string
    reason: string
  }) => void
}

export function processGovernanceDecision(
  input: GovernanceDecisionInput,
  deps: GovernanceTransactionDeps
): QuorumRequest {
  if (!input || typeof input !== 'object') throw invalidInput('object required')
  if (!deps || typeof deps !== 'object') throw invalidInput('deps required')

  const snapshot = deps.getRequest(input.requestId)
  if (!snapshot) throw notFound('quorum request not found', { requestId: input.requestId })

  try {
    const updated = deps.submitDecision(input)
    deps.appendLineage({
      decisionId: input.requestId,
      actorId: input.approverId,
      action: `quorum_${input.decision}`,
      reason: 'governance_decision'
    })
    return updated
  } catch (err) {
    deps.restoreRequest(snapshot)
    throw governanceTransactionFailed('decision+lineage transaction failed', {
      cause: err instanceof Error ? err.message : 'unknown',
      requestId: input.requestId
    })
  }
}

export function submitGovernanceDecision(input: GovernanceDecisionInput): QuorumRequest {
  return processGovernanceDecision(input, {
    getRequest: getQuorumRequestById,
    submitDecision: submitQuorumDecision,
    restoreRequest: upsertQuorumRequest,
    appendLineage: ({ decisionId, actorId, action, reason }) => {
      buildGovernanceAuditLineage({
        decisionId,
        actorId,
        action,
        reason
      })
    }
  })
}
