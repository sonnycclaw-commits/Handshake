import type { Bindings } from './types'
import { D1RequestWorkflowStore } from '../adapters/persistence/d1-request-workflow-store'
import { createRequestWorkflowService } from '../domain/services/request-workflow.service'
import type { RequestWorkflowService } from '../domain/services/request-workflow.service.types'
import { createHITLRequest, approveHITL, rejectHITL, timeoutHITL } from '../domain/services/hitl-workflow'
import { incrWF5Metric } from '../domain/services/wf5-ops-metrics'
import { setHITLStore } from '../domain/services/hitl-workflow'
import { D1HITLStore } from '../adapters/persistence/d1-hitl-store'

export function createWorkflowServices(env: Bindings): { requestWorkflowService: RequestWorkflowService } {
  const requestStore = new D1RequestWorkflowStore(env.DB)
  setHITLStore(new D1HITLStore(env.DB))

  const requestWorkflowService = createRequestWorkflowService({
    requestStore,
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

  return { requestWorkflowService }
}
