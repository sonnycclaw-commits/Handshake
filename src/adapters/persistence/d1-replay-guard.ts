import type { ReplayGuard, ReplayReserveResult, ReplayScope } from '../../ports/replay-guard'

const MAX_KEY_LEN = 256

function toCompositeKey(scope: ReplayScope, key: string): string {
  return `${scope}:${key}`
}

export class D1ReplayGuard implements ReplayGuard {
  constructor(private readonly db: D1Database) {}

  async reserve(input: {
    scope: ReplayScope
    key: string
    ttlSeconds: number
    nowMs: number
  }): Promise<ReplayReserveResult> {
    const key = String(input.key || '').trim()
    if (!key || key.length > MAX_KEY_LEN) {
      return { ok: false, reason: 'unavailable' }
    }

    const compositeKey = toCompositeKey(input.scope, key)
    const expiresAt = input.nowMs + Math.max(1, Math.floor(input.ttlSeconds)) * 1000

    try {
      await this.db.prepare(
        'INSERT INTO replay_guards (guard_key, scope, created_at, expires_at) VALUES (?, ?, ?, ?)'
      )
        .bind(compositeKey, input.scope, input.nowMs, expiresAt)
        .run()

      return { ok: true }
    } catch (err: any) {
      const message = String(err?.message ?? '')
      if (message.includes('UNIQUE') || message.includes('unique')) {
        return { ok: false, reason: 'replay_detected' }
      }
      return { ok: false, reason: 'unavailable' }
    }
  }
}
