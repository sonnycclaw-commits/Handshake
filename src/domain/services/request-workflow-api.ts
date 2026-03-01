import { createRequestWorkflowService } from './request-workflow.service'
import type { RequestWorkflowStore } from '../../ports/request-workflow-store'
import { DefaultInMemoryRequestWorkflowStore } from './request-workflow-in-memory-store'
import { createHITLRequest, approveHITL, rejectHITL, timeoutHITL } from './hitl-workflow'
import { incrWF5Metric } from './wf5-ops-metrics'

const defaultStore: RequestWorkflowStore = new DefaultInMemoryRequestWorkflowStore()

const defaultService = createRequestWorkflowService({
  requestStore: defaultStore,
  hitl: {
    create: createHITLRequest,
    approve: approveHITL,
    reject: rejectHITL,
    timeout: timeoutHITL,
  },
  metrics: {
    incr: (metric, value, tags) => incrWF5Metric(metric as any, value as any, tags as any),
  },
  clock: {
    nowMs: () => Date.now(),
  },
})

export async function submitRequest(input: Parameters<typeof defaultService.submitRequest>[0]) {
  return defaultService.submitRequest(input)
}

export async function resolveRequestHitl(input: Parameters<typeof defaultService.resolveRequestHitl>[0]) {
  return defaultService.resolveRequestHitl(input)
}

export async function authorizePrivilegedExecution(input: Parameters<typeof defaultService.authorizePrivilegedExecution>[0]) {
  return defaultService.authorizePrivilegedExecution(input)
}

export async function getRequestLineage(requestId: string) {
  return defaultService.getRequestLineage(requestId)
}

export async function getRequestAudit(requestId: string) {
  return defaultService.getRequestAudit(requestId)
}
