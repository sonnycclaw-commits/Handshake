export type HITLStatus = 'pending' | 'approved' | 'rejected'

export interface HITLStoredRequest {
  id: string
  agentId: string
  principalId: string
  tier: number
  action: string
  status: HITLStatus
  reason?: string
  approverId?: string
  createdAt: number
  expiresAt: number
}

export interface HITLStore {
  save(request: HITLStoredRequest): Promise<void>
  get(id: string): Promise<HITLStoredRequest | null>
}
