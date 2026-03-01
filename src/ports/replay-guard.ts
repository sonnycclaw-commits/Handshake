export type ReplayScope = 'workflow_idempotency' | 'internal_trust_jti'

export type ReplayReserveResult =
  | { ok: true }
  | { ok: false; reason: 'replay_detected' | 'unavailable' }

export interface ReplayGuard {
  reserve(input: {
    scope: ReplayScope
    key: string
    ttlSeconds: number
    nowMs: number
  }): Promise<ReplayReserveResult>
}
