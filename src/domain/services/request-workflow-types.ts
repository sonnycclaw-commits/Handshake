export type RequestDecision = 'allow' | 'deny' | 'escalate'

export type RequestState =
  | 'submitted'
  | 'allowed_terminal'
  | 'denied_terminal'
  | 'escalated_pending'
  | 'escalated_approved_terminal'
  | 'escalated_rejected_terminal'
  | 'escalated_expired_terminal'

export interface RequestInput {
  requestId: string
  principalId: string
  agentId: string
  actionType: 'payment' | 'data_access' | 'credential_use' | 'external_call' | 'other'
  payloadRef: string
  timestamp: number
  privilegedPath: boolean
  context?: Record<string, unknown>
}

export interface RequestResult {
  requestId: string
  decision: RequestDecision
  reasonCode: string
  tier: number
  timestamp: number
  decisionContextHash: string
  responseClass?: 'ok' | 'retryable' | 'blocked' | 'unknown'
  hitlRequestId?: string
  txnId?: string
}

export type RequestRecord = {
  input: RequestInput
  state: RequestState
  result: RequestResult
  hitlRequestId?: string
  terminal: boolean
  decisionContextHash: string
  responseClass?: 'ok' | 'retryable' | 'blocked' | 'unknown'
}

export interface DecisionArtifact {
  requestId: string
  decision: RequestDecision
  reasonCode: string
  tier: number
  timestamp: number
  decisionContextHash: string
  responseClass?: 'ok' | 'retryable' | 'blocked' | 'unknown'
  hitlRequestId?: string
  txnId?: string
}

export const DEFAULT_POLICY = {
  maxTransaction: 100,
  dailySpendLimit: 1000,
  allowedHours: '00:00-23:59',
  allowedCategories: ['ops', 'infra', 'subscriptions', 'food', 'transport']
}

export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000
