import type { Bindings } from './types'
import { D1ReplayGuard } from '../adapters/persistence/d1-replay-guard'

export function createReplayGuard(env: Bindings) {
  return new D1ReplayGuard(env.DB)
}
