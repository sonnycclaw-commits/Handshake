import { verifyToken } from '@clerk/backend'
import type { IdentityProvider, VerifyPrincipalResult } from '../../ports/identity-provider'

type ClerkIdentityConfig = {
  jwtKey?: string
  secretKey?: string
  audience?: string
  authorizedParties?: string[]
}

export class ClerkIdentityProvider implements IdentityProvider {
  constructor(private readonly config: ClerkIdentityConfig) {}

  async verifyAuthorizationHeader(authorizationHeader?: string): Promise<VerifyPrincipalResult> {
    if (!authorizationHeader?.startsWith('Bearer ')) {
      return { ok: false, reasonCode: 'security_missing_authorization_header' }
    }

    const token = authorizationHeader.slice(7).trim()
    if (!token) {
      return { ok: false, reasonCode: 'security_missing_authorization_header' }
    }

    try {
      const payload = await verifyToken(token, {
        jwtKey: this.config.jwtKey,
        secretKey: this.config.secretKey,
        audience: this.config.audience,
        authorizedParties: this.config.authorizedParties,
      })

      const sub = (payload as any)?.sub
      if (!sub || typeof sub !== 'string') {
        return { ok: false, reasonCode: 'security_identity_claim_missing' }
      }

      return {
        ok: true,
        principal: {
          principalId: sub,
          ownerProvider: 'clerk',
          ownerId: sub,
          ownerDisplayName: null,
        },
      }
    } catch {
      return { ok: false, reasonCode: 'security_token_invalid' }
    }
  }
}
