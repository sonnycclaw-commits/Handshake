import type { StateStore, VerificationState } from '../../ports/state-store'

type VerificationStateRaw = {
  agent_id: string
  provider: string
  privacy_level: string
  code_verifier: string
  created_at: string
}

export class KvStateStore implements StateStore {
  constructor(private readonly kv: KVNamespace) {}

  async putVerificationState(state: string, data: VerificationState, ttlSeconds: number): Promise<void> {
    const payload: VerificationStateRaw = {
      agent_id: data.agentId,
      provider: data.provider,
      privacy_level: data.privacyLevel,
      code_verifier: data.codeVerifier,
      created_at: data.createdAt
    }

    await this.kv.put(stateKey(state), JSON.stringify(payload), { expirationTtl: ttlSeconds })
  }

  async getVerificationState(state: string): Promise<VerificationState | null> {
    const raw = await this.kv.get(stateKey(state))
    if (!raw) return null

    const parsed = JSON.parse(raw) as VerificationStateRaw
    return {
      agentId: parsed.agent_id,
      provider: parsed.provider,
      privacyLevel: parsed.privacy_level,
      codeVerifier: parsed.code_verifier,
      createdAt: parsed.created_at
    }
  }

  async deleteVerificationState(state: string): Promise<void> {
    await this.kv.delete(stateKey(state))
  }
}

function stateKey(state: string): string {
  return `state:${state}`
}
