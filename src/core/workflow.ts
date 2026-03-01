import { D1RequestWorkflowStore } from '../adapters/persistence/d1-request-workflow-store'
import { toResponseClass } from '../domain/constants/reason-codes'
import { statusForReasonCodeStrict } from '../domain/constants/reason-code-http'
import type { RequestInput } from '../domain/services/request-workflow-types'
import type { Bindings } from './types'

export function configureWorkflowStores(env: Bindings): D1RequestWorkflowStore {
  return new D1RequestWorkflowStore(env.DB)
}

export function mapTierToRiskTier(tier: number): 'low' | 'medium' | 'high' | 'critical' | 'unknown' {
  if (!Number.isFinite(tier)) return 'unknown'
  if (tier >= 4) return 'critical'
  if (tier >= 3) return 'high'
  if (tier >= 2) return 'medium'
  return 'low'
}

export function maxNumericTimestamp(values: unknown[]): number | undefined {
  let max = Number.NEGATIVE_INFINITY
  for (const v of values) {
    const n = Number(v)
    if (Number.isFinite(n) && n > max) max = n
  }
  if (!Number.isFinite(max)) return undefined
  return max
}

export function statusForReasonCode(reasonCode: string): 400 | 401 | 403 | 404 | 409 | 422 | 503 {
  return statusForReasonCodeStrict(reasonCode)
}

export function toStructuredError(reasonCode: string, message: string) {
  return {
    status: 'error' as const,
    error: reasonCode,
    reasonCode,
    responseClass: toResponseClass({ decision: 'deny', reasonCode }),
    message,
  }
}

export function isActionType(value: unknown): value is RequestInput['actionType'] {
  return value === 'payment' || value === 'data_access' || value === 'credential_use' || value === 'external_call' || value === 'other'
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
