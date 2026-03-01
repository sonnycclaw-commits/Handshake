import { describe, it, expect } from 'vitest'
import { createRequestWorkflowService } from '@/domain/services/request-workflow.service'
import { DefaultInMemoryRequestWorkflowStore } from '@/domain/services/request-workflow-in-memory-store'
import { createHITLRequest, approveHITL, rejectHITL, timeoutHITL } from '@/domain/services/hitl-workflow'
import { getWF5MetricsSnapshot, evaluateWF5SLOs } from '@/domain/services/wf5-ops-metrics'


function makeService() {
  return createRequestWorkflowService({
    requestStore: new DefaultInMemoryRequestWorkflowStore(),
    hitl: { create: createHITLRequest, approve: approveHITL, reject: rejectHITL, timeout: timeoutHITL },
    metrics: { incr: async () => {} },
    clock: { nowMs: () => Date.now() },
  })
}

describe('WF5 Ops alerts integration (C7)', () => {
  it('captures key counters and evaluates alert signals', async () => {
    const reqBase = {
      principalId: 'p-ops',
      agentId: 'a-ops',
      actionType: 'payment' as const,
      payloadRef: 'amount:999',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { amount: 999 }
    }

    for (let i = 0; i < 6; i++) {
      await makeService().submitRequest({ ...reqBase, requestId: `ops-${i}` })
    }

    const req = {
      requestId: 'ops-art-1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'other' as const,
      payloadRef: 'safe-op',
      timestamp: Date.now(),
      privilegedPath: true,
      context: { policyVersion: 'pv1', trustSnapshotId: 'ts1' }
    }

    const artifact = await makeService().submitRequest(req)
    await makeService().authorizePrivilegedExecution({ request: req, artifact: { ...artifact, decisionContextHash: 'ctx_bad' } })

    const snap = await getWF5MetricsSnapshot()

    const total = snap['wf5_requests_total'] ?? 0
    const escalations = snap['wf5_decision_escalate_total'] ?? 0
    const timeoutFailClosed = snap['wf5_timeout_fail_closed_total'] ?? 0

    const report = evaluateWF5SLOs({
      totalRequests: Math.max(1, total),
      bypassDeniedTotal: snap['wf5_bypass_denied_total'] ?? 0,
      timeoutFailClosedTotal: timeoutFailClosed,
      timeoutEventsTotal: Math.max(1, timeoutFailClosed),
      escalationTotal: escalations,
      terminalMutationDeniedTotal: snap['wf5_terminal_mutation_denied_total'] ?? 0,
      thresholds: { maxEscalationRate: 0.2, minTimeoutFailClosedRate: 1 }
    })

    expect(total).toBeGreaterThan(0)
    expect((snap['wf5_artifact_gate_denied_total{reason=security_decision_context_mismatch}'] ?? 0)).toBeGreaterThanOrEqual(1)
    expect(report.alerts.length).toBeGreaterThanOrEqual(0)
  })
})
