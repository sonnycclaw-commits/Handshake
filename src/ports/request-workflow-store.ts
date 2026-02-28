import type { RequestDecision } from '../domain/services/request-workflow-types'

export type RequestState =
  | 'submitted'
  | 'allowed_terminal'
  | 'denied_terminal'
  | 'escalated_pending'
  | 'escalated_approved_terminal'
  | 'escalated_rejected_terminal'
  | 'escalated_expired_terminal'

export interface StoredRequestResult {
  requestId: string
  decision: RequestDecision
  reasonCode: string
  tier: number
  timestamp: number
  decisionContextHash: string
  hitlRequestId?: string
  txnId?: string
}

export interface StoredRequestRecord {
  requestId: string
  principalId: string
  agentId: string
  actionType: 'payment' | 'data_access' | 'credential_use' | 'external_call' | 'other'
  payloadRef: string
  requestTimestamp: number
  state: RequestState
  terminal: boolean
  decisionContextHash: string
  hitlRequestId?: string
  result: StoredRequestResult
}

export interface RequestWorkflowStore {
  getRequest(requestId: string): Promise<StoredRequestRecord | null>
  saveRequest(record: StoredRequestRecord): Promise<void>

  appendAudit(requestId: string, event: Record<string, unknown>): Promise<void>
  getAudit(requestId: string): Promise<Array<Record<string, unknown>>>

  appendLineage(requestId: string, event: Record<string, unknown>): Promise<void>
  getLineage(requestId: string): Promise<Array<Record<string, unknown>>>

  getEscalationHistory(key: string): Promise<number[]>
  setEscalationHistory(key: string, timestamps: number[]): Promise<void>
}
