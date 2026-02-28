export type VerifiedPrincipal = {
  principalId: string
  ownerProvider: 'clerk'
  ownerId: string
  ownerDisplayName?: string | null
}

export type VerifyPrincipalResult =
  | { ok: true; principal: VerifiedPrincipal }
  | { ok: false; reasonCode: string }

export interface IdentityProvider {
  verifyAuthorizationHeader(authorizationHeader?: string): Promise<VerifyPrincipalResult>
}
