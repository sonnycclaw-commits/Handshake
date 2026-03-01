import type { RequestInput, RequestRecord, RequestResult } from './request-workflow-types'
import type { RequestWorkflowStore } from '../../ports/request-workflow-store'
import { toStoredRecord } from './request-workflow-persistence'

export interface ResolveHitlInput {
  requestId: string
  hitlRequestId: string
  decision: 'approve' | 'reject' | 'timeout'
  timestamp: number
}

type Deps = {
  workflowStore: RequestWorkflowStore
  timeoutHITL: (id: string, now?: number) => Promise<unknown>
  rejectHITL: (id: string, meta: { reason?: string }) => Promise<unknown>
  approveHITL: (id: string, meta: { approverId?: string }) => Promise<unknown>
  appendAuditLegacy: (requestId: string, event: Record<string, unknown>) => void
  appendLineage: (requestId: string, event: Record<string, unknown>) => Promise<void>
  incrWF5Metric: (metric: string) => Promise<void>
  deny: (input: RequestInput, reasonCode: string, tier?: number) => RequestResult
  allow: (input: RequestInput, reasonCode?: string, tier?: number) => RequestResult
}

async function persistTerminal(
  record: RequestRecord,
  out: RequestResult,
  state: 'escalated_expired_terminal' | 'escalated_rejected_terminal' | 'escalated_approved_terminal',
  deps: Deps
): Promise<RequestRecord> {
  const next: RequestRecord = {
    ...record,
    state,
    result: out,
    terminal: true,
  }

  await deps.workflowStore.saveRequest(toStoredRecord(next.input, next.result))

  const event = {
    event: 'hitl_resolved',
    state,
    decision: out.decision,
    reasonCode: out.reasonCode,
    timestamp: out.timestamp,
  }

  deps.appendAuditLegacy(record.input.requestId, event)
  await deps.workflowStore.appendAudit(record.input.requestId, event)
  await deps.appendLineage(record.input.requestId, { ...event, event: 'request_terminal' })

  return next
}

export async function resolveTimeoutBranch(record: RequestRecord, input: ResolveHitlInput, deps: Deps): Promise<RequestRecord> {
  await deps.timeoutHITL(record.hitlRequestId!, input.timestamp)
  await deps.incrWF5Metric('wf5_timeout_fail_closed_total')
  const out = deps.deny(record.input, 'hitl_timeout_fail_closed', 4)
  return persistTerminal(record, out, 'escalated_expired_terminal', deps)
}

export async function resolveRejectBranch(record: RequestRecord, deps: Deps): Promise<RequestRecord> {
  await deps.rejectHITL(record.hitlRequestId!, { reason: 'manual_reject' })
  const out = deps.deny(record.input, 'hitl_rejected', 4)
  return persistTerminal(record, out, 'escalated_rejected_terminal', deps)
}

export async function resolveApproveBranch(record: RequestRecord, deps: Deps, approverId?: string): Promise<RequestRecord> {
  const actor = typeof approverId === 'string' && approverId.trim().length > 0
    ? approverId.trim()
    : record.input.principalId

  try {
    await deps.approveHITL(record.hitlRequestId!, { approverId: actor })
  } catch {
    const out = deps.deny(record.input, 'hitl_approval_unauthorized', 4)
    const event = {
      event: 'hitl_resolved',
      state: 'escalated_rejected_terminal',
      decision: out.decision,
      reasonCode: out.reasonCode,
      timestamp: out.timestamp,
    }
    deps.appendAuditLegacy(record.input.requestId, event)
    await deps.workflowStore.appendAudit(record.input.requestId, event)
    await deps.appendLineage(record.input.requestId, { ...event, event: 'request_terminal' })
    return {
      ...record,
      state: 'escalated_rejected_terminal',
      result: out,
      terminal: true,
    }
  }

  const out = deps.allow(record.input, 'hitl_approved', 3)
  const next: RequestRecord = {
    ...record,
    state: 'escalated_approved_terminal',
    result: out,
    terminal: true,
  }

  await deps.workflowStore.saveRequest(toStoredRecord(next.input, next.result))

  const event = {
    event: 'hitl_resolved',
    state: 'escalated_approved_terminal',
    decision: out.decision,
    reasonCode: out.reasonCode,
    timestamp: out.timestamp,
  }
  deps.appendAuditLegacy(record.input.requestId, event)
  await deps.workflowStore.appendAudit(record.input.requestId, event)

  return next
}
