import type { RequestInput, RequestResult, DecisionArtifact } from './request-workflow-types'
import type { RequestWorkflowStore } from '../../ports/request-workflow-store'

export type RequestWorkflowDeps = {
  requestStore: RequestWorkflowStore
  hitl: {
    create(input: { agentId: string; principalId: string; tier: number; action: string }): Promise<{ id: string }>
    approve(id: string, meta: { approverId?: string }): Promise<unknown>
    reject(id: string, meta: { reason?: string }): Promise<unknown>
    timeout(id: string, now?: number): Promise<unknown>
  }
  metrics: {
    incr(metric: string, value?: number, tags?: Record<string, string>): Promise<void>
  }
  clock: {
    nowMs(): number
  }
}

export type RequestWorkflowService = {
  submitRequest(input: RequestInput): Promise<RequestResult>
  resolveRequestHitl(input: {
    requestId: string
    hitlRequestId: string
    decision: 'approve' | 'reject' | 'timeout'
    timestamp: number
    approverId?: string
  }): Promise<RequestResult>
  authorizePrivilegedExecution(input: {
    request: RequestInput
    artifact?: DecisionArtifact | null
  }): Promise<{ allowed: boolean; reasonCode: string }>
  getRequestLineage(requestId: string): Promise<Array<Record<string, unknown>>>
  getRequestAudit(requestId: string): Promise<Array<Record<string, unknown>>>
}
