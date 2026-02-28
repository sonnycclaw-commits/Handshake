import type { CredentialService } from '../ports/credential-service'
import type { IdentityStore } from '../ports/identity-store'
import type { StateStore } from '../ports/state-store'
import type { IdentityProvider } from '../ports/identity-provider'

type BuildOAuthUrl = (provider: string, state: string, codeChallenge: string) => string

type ExchangeCodeForToken = (provider: string, code: string, codeVerifier: string) => Promise<any>

type GetUserProfile = (provider: string, accessToken: string) => Promise<any>

type Helpers = {
  randomString(length: number): string
  generateCodeChallenge(verifier: string): Promise<string>
  buildOAuthUrl: BuildOAuthUrl
  exchangeCodeForToken: ExchangeCodeForToken
  getUserProfile: GetUserProfile
  getOwnerDisplay(linkage: any): string
  computeVerificationLevel(linkage: any): string
  computeBadge(linkage: any): string
}

type Deps = {
  identityStore: IdentityStore
  stateStore: StateStore
  credentialService: CredentialService
  helpers: Helpers
  identityProvider?: IdentityProvider
  identityMode?: 'legacy' | 'clerk'
}

export class L0VerificationUseCases {
  constructor(private readonly deps: Deps) {}

  private get identityMode(): 'legacy' | 'clerk' {
    return this.deps.identityMode ?? 'legacy'
  }

  async startVerification(input: {
    agentId?: string
    provider?: string
    privacyLevel?: string
  }): Promise<{ status: number; body: any }> {
    if (this.identityMode === 'clerk') {
      return {
        status: 410,
        body: {
          status: 'error',
          error: 'identity_provider_clerk_mode',
          message: 'Legacy OAuth start is disabled in Clerk mode.'
        }
      }
    }

    const { agentId, provider, privacyLevel = 'full' } = input

    if (!agentId || !provider) {
      return {
        status: 400,
        body: { status: 'error', error: 'invalid_request', message: 'agent_id and provider are required' }
      }
    }

    if (!['google', 'github'].includes(provider)) {
      return {
        status: 400,
        body: { status: 'error', error: 'invalid_provider', message: 'provider must be google or github' }
      }
    }

    const existing = await this.deps.identityStore.getActiveLinkageByAgentId(agentId)
    if (existing) {
      return {
        status: 409,
        body: { status: 'error', error: 'already_verified', message: 'Agent is already verified' }
      }
    }

    const state = this.deps.helpers.randomString(32)
    const codeVerifier = this.deps.helpers.randomString(128)
    const codeChallenge = await this.deps.helpers.generateCodeChallenge(codeVerifier)

    await this.deps.stateStore.putVerificationState(
      state,
      {
        agentId,
        provider,
        privacyLevel,
        codeVerifier,
        createdAt: new Date().toISOString()
      },
      300
    )

    const verificationUrl = this.deps.helpers.buildOAuthUrl(provider, state, codeChallenge)
    return {
      status: 200,
      body: { verification_url: verificationUrl, state, expires_in: 300 }
    }
  }

  async completeVerification(input: {
    code?: string
    state?: string
    oauthError?: string
  }): Promise<{ status: number; body: any }> {
    if (this.identityMode === 'clerk') {
      return {
        status: 410,
        body: {
          status: 'error',
          error: 'identity_provider_clerk_mode',
          message: 'Legacy OAuth callback is disabled in Clerk mode.'
        }
      }
    }

    const { code, state, oauthError } = input

    if (oauthError) {
      return {
        status: 401,
        body: { status: 'error', error: 'oauth_denied', message: 'OAuth authorization was denied' }
      }
    }

    if (!code || !state) {
      return {
        status: 400,
        body: { status: 'error', error: 'invalid_request', message: 'code and state are required' }
      }
    }

    const stateData = await this.deps.stateStore.getVerificationState(state)
    if (!stateData) {
      return {
        status: 400,
        body: { status: 'error', error: 'invalid_state', message: 'State expired or invalid' }
      }
    }

    await this.deps.stateStore.deleteVerificationState(state)

    const tokenData = await this.deps.helpers.exchangeCodeForToken(stateData.provider, code, stateData.codeVerifier)
    if (!tokenData.access_token) {
      return {
        status: 401,
        body: {
          status: 'error',
          error: 'token_exchange_failed',
          message: 'Failed to exchange authorization code'
        }
      }
    }

    const profile = await this.deps.helpers.getUserProfile(stateData.provider, tokenData.access_token)
    if (!profile || !profile.id) {
      return {
        status: 401,
        body: { status: 'error', error: 'profile_fetch_failed', message: 'Failed to fetch user profile' }
      }
    }

    const linkageId = this.deps.helpers.randomString(16)
    const verifiedAt = new Date().toISOString()

    await this.deps.identityStore.createLinkage({
      id: linkageId,
      agentId: stateData.agentId,
      ownerProvider: stateData.provider,
      ownerId: profile.id,
      ownerDisplayName: stateData.privacyLevel === 'anonymous' ? null : profile.name,
      privacyLevel: stateData.privacyLevel,
      verifiedAt
    })

    await this.deps.identityStore.incrementAgentsOwned(stateData.provider, profile.id)

    const credential = await this.deps.credentialService.issue({
      agentId: stateData.agentId,
      ownerProvider: stateData.provider,
      ownerId: profile.id,
      ownerDisplayName: profile.name,
      privacyLevel: stateData.privacyLevel
    })

    return {
      status: 200,
      body: {
        status: 'verified',
        agent_id: stateData.agentId,
        owner: {
          provider: stateData.provider,
          id: stateData.privacyLevel === 'anonymous' ? undefined : profile.id,
          display_name: stateData.privacyLevel === 'full' ? profile.name : undefined
        },
        privacy_level: stateData.privacyLevel,
        verified_at: verifiedAt,
        badge: '🤝 verified',
        credential,
        credential_expires_in: 86400,
        refresh_hint: 'POST /refresh with Authorization: Bearer <credential> to get new credential'
      }
    }
  }

  async verifyAgent(input: {
    agentId: string
    authorizationHeader?: string
  }): Promise<{ status: number; body: any }> {
    if (this.identityMode === 'clerk' && this.deps.identityProvider) {
      const principal = await this.deps.identityProvider.verifyAuthorizationHeader(input.authorizationHeader)
      if (principal.ok) {
        const linkage = await this.deps.identityStore.getActiveLinkageWithTrustByAgentId(input.agentId)
        if (!linkage) {
          return {
            status: 200,
            body: { verified: false, agent_id: input.agentId }
          }
        }

        const joined = {
          ...toLegacyLinkage(linkage.linkage),
          agents_owned: linkage.trust.agentsOwned,
          offers_published: linkage.trust.offersPublished,
          successful_trades: linkage.trust.successfulTrades,
          reputation_score: linkage.trust.reputationScore
        }

        return {
          status: 200,
          body: {
            verified: true,
            agent_id: input.agentId,
            owner: {
              provider: linkage.linkage.ownerProvider,
              display: this.deps.helpers.getOwnerDisplay(joined)
            },
            verification_mode: 'online',
            verification_level: this.deps.helpers.computeVerificationLevel(joined),
            badge: this.deps.helpers.computeBadge(joined),
            verified_at: linkage.linkage.verifiedAt,
            trust_signals: {
              agents_owned: linkage.trust.agentsOwned,
              offers_published: linkage.trust.offersPublished,
              successful_trades: linkage.trust.successfulTrades,
              reputation_score: linkage.trust.reputationScore
            },
            identity_source: 'clerk'
          }
        }
      }

      return {
        status: 401,
        body: {
          status: 'error',
          error: principal.reasonCode,
          message: 'Clerk identity verification failed'
        }
      }
    }

    if (input.authorizationHeader?.startsWith('Bearer ')) {
      const token = input.authorizationHeader.slice(7)
      const verified = await this.deps.credentialService.verify(token)

      if (verified && verified.agentId === input.agentId) {
        return {
          status: 200,
          body: {
            verified: true,
            agent_id: input.agentId,
            owner: {
              provider: verified.ownerProvider,
              display: verified.ownerDisplayName || 'Verified Owner'
            },
            verification_mode: 'offline',
            verification_level: 'basic',
            badge: '🤝 verified',
            verified_at: verified.verifiedAt,
            credential_expires_at: verified.exp,
            note: 'Offline verification. No trust signals. For trust signals, use database verification (omit Authorization header).'
          }
        }
      }
    }

    const linkage = await this.deps.identityStore.getActiveLinkageWithTrustByAgentId(input.agentId)
    if (!linkage) {
      return {
        status: 200,
        body: { verified: false, agent_id: input.agentId }
      }
    }

    const joined = {
      ...toLegacyLinkage(linkage.linkage),
      agents_owned: linkage.trust.agentsOwned,
      offers_published: linkage.trust.offersPublished,
      successful_trades: linkage.trust.successfulTrades,
      reputation_score: linkage.trust.reputationScore
    }

    return {
      status: 200,
      body: {
        verified: true,
        agent_id: input.agentId,
        owner: {
          provider: linkage.linkage.ownerProvider,
          display: this.deps.helpers.getOwnerDisplay(joined)
        },
        verification_mode: 'online',
        verification_level: this.deps.helpers.computeVerificationLevel(joined),
        badge: this.deps.helpers.computeBadge(joined),
        verified_at: linkage.linkage.verifiedAt,
        trust_signals: {
          agents_owned: linkage.trust.agentsOwned,
          offers_published: linkage.trust.offersPublished,
          successful_trades: linkage.trust.successfulTrades,
          reputation_score: linkage.trust.reputationScore
        }
      }
    }
  }

  async refreshCredential(input: {
    authorizationHeader?: string
  }): Promise<{ status: number; body: any }> {
    if (!input.authorizationHeader?.startsWith('Bearer ')) {
      return {
        status: 401,
        body: {
          status: 'error',
          error: 'missing_credential',
          message: 'Authorization header with Bearer token required'
        }
      }
    }

    const token = input.authorizationHeader.slice(7)
    const verified = await this.deps.credentialService.verify(token)

    if (!verified) {
      return {
        status: 401,
        body: {
          status: 'error',
          error: 'invalid_credential',
          message: 'Credential verification failed'
        }
      }
    }

    const linkage = await this.deps.identityStore.getActiveLinkageWithTrustByAgentId(verified.agentId)
    if (!linkage) {
      return {
        status: 403,
        body: {
          status: 'error',
          error: 'revoked',
          message: 'Agent verification has been revoked'
        }
      }
    }

    const credential = await this.deps.credentialService.issue({
      agentId: verified.agentId,
      ownerProvider: verified.ownerProvider,
      ownerId: verified.ownerId,
      ownerDisplayName: verified.ownerDisplayName,
      privacyLevel: verified.privacyLevel
    })

    return {
      status: 200,
      body: {
        status: 'refreshed',
        agent_id: verified.agentId,
        credential,
        credential_expires_in: 86400,
        trust_signals: {
          agents_owned: linkage.trust.agentsOwned,
          offers_published: linkage.trust.offersPublished,
          successful_trades: linkage.trust.successfulTrades,
          reputation_score: linkage.trust.reputationScore
        }
      }
    }
  }

  async verifyCredentialOffline(input: {
    credential?: string
  }): Promise<{ status: number; body: any }> {
    if (!input.credential) {
      return {
        status: 400,
        body: { status: 'error', error: 'missing_credential', message: 'credential is required' }
      }
    }

    const verified = await this.deps.credentialService.verify(input.credential)
    if (!verified) {
      return {
        status: 401,
        body: {
          status: 'error',
          error: 'invalid_credential',
          message: 'Credential verification failed'
        }
      }
    }

    return {
      status: 200,
      body: {
        status: 'verified',
        verification_mode: 'offline',
        agent_id: verified.agentId,
        owner: {
          provider: verified.ownerProvider,
          id: verified.ownerId,
          display_name: verified.ownerDisplayName
        },
        verified_at: verified.verifiedAt,
        credential_expires_at: verified.exp,
        note: 'Offline verification. For revocation status and trust signals, use GET /verify/:agent_id without Authorization header.'
      }
    }
  }
}

function toLegacyLinkage(linkage: {
  id: string
  agentId: string
  ownerProvider: string
  ownerId: string | null
  ownerDisplayName: string | null
  privacyLevel: string
  verifiedAt: string
  revokedAt?: string | null
}): any {
  return {
    id: linkage.id,
    agent_id: linkage.agentId,
    owner_provider: linkage.ownerProvider,
    owner_id: linkage.ownerId,
    owner_display_name: linkage.ownerDisplayName,
    privacy_level: linkage.privacyLevel,
    verified_at: linkage.verifiedAt,
    revoked_at: linkage.revokedAt ?? null
  }
}
