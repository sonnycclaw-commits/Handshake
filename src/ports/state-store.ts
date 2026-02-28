export interface VerificationState {
  agentId: string
  provider: string
  privacyLevel: string
  codeVerifier: string
  createdAt: string
}

export interface StateStore {
  putVerificationState(state: string, data: VerificationState, ttlSeconds: number): Promise<void>
  getVerificationState(state: string): Promise<VerificationState | null>
  deleteVerificationState(state: string): Promise<void>
}
