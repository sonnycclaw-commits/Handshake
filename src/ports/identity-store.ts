export interface LinkageRecord {
  id: string
  agentId: string
  ownerProvider: string
  ownerId: string | null
  ownerDisplayName: string | null
  privacyLevel: string
  verifiedAt: string
  revokedAt?: string | null
}

export interface TrustSignals {
  agentsOwned: number
  offersPublished: number
  successfulTrades: number
  reputationScore: number
}

export interface LinkageWithTrust {
  linkage: LinkageRecord
  trust: TrustSignals
}

export interface CreateLinkageInput {
  id: string
  agentId: string
  ownerProvider: string
  ownerId: string
  ownerDisplayName: string | null
  privacyLevel: string
  verifiedAt: string
}

export interface IdentityStore {
  getActiveLinkageByAgentId(agentId: string): Promise<LinkageRecord | null>
  getActiveLinkageWithTrustByAgentId(agentId: string): Promise<LinkageWithTrust | null>
  getActiveLinkageByAgentIdAndOwner(agentId: string, ownerProvider: string, ownerId: string): Promise<LinkageRecord | null>
  createLinkage(input: CreateLinkageInput): Promise<void>
  incrementAgentsOwned(ownerProvider: string, ownerId: string): Promise<void>
}
