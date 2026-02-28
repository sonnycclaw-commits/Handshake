import type { RequestWorkflowStore } from '../../ports/request-workflow-store'
import type { RequestInput, RequestResult } from './request-workflow-types'

const ESCALATION_WINDOW_MS = 10 * 60 * 1000
const MAX_ESCALATIONS_PER_WINDOW = 5

function escalationKey(input: RequestInput): string {
  return `${input.principalId}::${input.agentId}`
}

function pruneEscalations(times: number[], now: number): number[] {
  const cutoff = now - ESCALATION_WINDOW_MS
  return times.filter((t) => t >= cutoff)
}

async function isEscalationThrottled(store: RequestWorkflowStore, input: RequestInput, now: number): Promise<boolean> {
  const key = escalationKey(input)
  const persisted = await store.getEscalationHistory(key)
  const pruned = pruneEscalations(persisted, now)
  await store.setEscalationHistory(key, pruned)
  return pruned.length >= MAX_ESCALATIONS_PER_WINDOW
}

async function registerEscalation(store: RequestWorkflowStore, input: RequestInput, now: number): Promise<void> {
  const key = escalationKey(input)
  const persisted = await store.getEscalationHistory(key)
  const pruned = pruneEscalations(persisted, now)
  pruned.push(now)
  await store.setEscalationHistory(key, pruned)
}

export async function applyEscalationGuard(args: {
  input: RequestInput
  result: RequestResult
  store: RequestWorkflowStore
  nowMs: () => number
  deny: (input: RequestInput, reasonCode: string, tier?: number) => RequestResult
  incrMetric: (metric: string) => Promise<void>
}): Promise<RequestResult> {
  const { input, result, store, nowMs, deny, incrMetric } = args
  if (result.decision !== 'escalate') return result

  const now = nowMs()
  if (await isEscalationThrottled(store, input, now)) {
    await incrMetric('wf5_escalation_throttled_total')
    return deny(input, 'security_escalation_flood_throttled', 4)
  }

  await registerEscalation(store, input, now)
  return result
}
