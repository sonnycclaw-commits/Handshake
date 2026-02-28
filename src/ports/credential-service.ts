export interface VerifiedCredentialPayload {
  agentId: string
  ownerProvider: string
  ownerId: string | null
  ownerDisplayName: string | null
  privacyLevel: string
  verifiedAt: string
  exp: number
}

export interface IssueCredentialInput {
  agentId: string
  ownerProvider: string
  ownerId: string | null
  ownerDisplayName: string | null
  privacyLevel: string
}

export interface CredentialService {
  issue(input: IssueCredentialInput): Promise<string>
  verify(token: string): Promise<VerifiedCredentialPayload | null>
}
