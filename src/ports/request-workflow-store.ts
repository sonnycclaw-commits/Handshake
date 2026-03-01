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
  tenantId?: string
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

  appendMetricsEvent(event: {
    eventId: string
    requestId: string
    timestampMs: number
    decision: RequestDecision
    reasonCode: string
    reasonFamily: string
    riskTier: string
    isTerminal: boolean
    hasValidLineage: boolean
    incidentDetectedTsMs?: number
    terminalDecisionTsMs?: number
    humanMinutes?: number
    computeCostUnits?: number
    escalationOverheadUnits?: number
    schemaVersion: string
    projectorVersion: string
  }): Promise<void>

  getMetricsEventsInWindow(startMs: number, endMs: number): Promise<Array<Record<string, unknown>>>

  upsertMetricsRollupHourly(row: {
    bucketStartMs: number
    metricName: string
    dimensionKey: string
    valueReal: number
    sampleCount: number
    schemaVersion: string
    projectorVersion: string
  }): Promise<void>

  upsertMetricsRollupDaily(row: {
    bucketStartMs: number
    metricName: string
    dimensionKey: string
    valueReal: number
    sampleCount: number
    schemaVersion: string
    projectorVersion: string
  }): Promise<void>

  getMetricsRollups(metricName: string, bucket: 'hour' | 'day', startMs: number, endMs: number): Promise<Array<Record<string, unknown>>>

  getEscalationHistory(key: string): Promise<number[]>
  setEscalationHistory(key: string, timestamps: number[]): Promise<void>
}
