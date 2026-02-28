import type { RequestInput } from './request-workflow-types'
import { DEFAULT_POLICY } from './request-workflow-types'

function stringifyStable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stringifyStable).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stringifyStable(obj[k])}`).join(',')}}`
}

function hashString(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i)
    hash = hash >>> 0
  }
  return `ctx_${hash.toString(16)}`
}

function normalizedTimestampBucket(ts: number): number {
  return Math.floor(ts / 60_000)
}

export function decisionContextHash(input: RequestInput): string {
  const ctx = input.context ?? {}
  const normalized = {
    principalId: input.principalId,
    agentId: input.agentId,
    actionType: input.actionType,
    payloadRef: input.payloadRef,
    policyVersion: String((ctx.policyVersion as string | undefined) ?? 'default'),
    trustSnapshotId: String((ctx.trustSnapshotId as string | undefined) ?? 'default'),
    timestampBucket: normalizedTimestampBucket(input.timestamp),
    policy: {
      maxTransaction: Number((ctx.maxTransaction as number | undefined) ?? DEFAULT_POLICY.maxTransaction),
      dailySpendLimit: Number((ctx.dailySpendLimit as number | undefined) ?? DEFAULT_POLICY.dailySpendLimit),
      allowedHours: String((ctx.allowedHours as string | undefined) ?? DEFAULT_POLICY.allowedHours),
      allowedCategories: Array.isArray(ctx.allowedCategories) ? (ctx.allowedCategories as string[]) : DEFAULT_POLICY.allowedCategories,
    },
    amount: Number((ctx.amount as number | undefined) ?? 0),
    category: String((ctx.category as string | undefined) ?? ''),
    sensitivity: String((ctx.sensitivity as string | undefined) ?? ''),
    authorizedSensitiveScope: Boolean((ctx.authorizedSensitiveScope as boolean | undefined) ?? false)
  }

  return hashString(stringifyStable(normalized))
}
