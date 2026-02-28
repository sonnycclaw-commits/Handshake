import { describe, it, expect } from 'vitest'
import { L0VerificationUseCases } from '@/use-cases/l0-verification'

const deps: any = {
  identityStore: {
    getActiveLinkageByAgentId: async () => null,
    getActiveLinkageWithTrustByAgentId: async () => null,
    getActiveLinkageByAgentIdAndOwner: async () => null,
    createLinkage: async () => {},
    incrementAgentsOwned: async () => {},
  },
  stateStore: {
    putVerificationState: async () => {},
    getVerificationState: async () => null,
    deleteVerificationState: async () => {},
  },
  credentialService: {
    issue: async () => 'jwt',
    verify: async () => null,
  },
  identityProvider: {
    verifyAuthorizationHeader: async () => ({ ok: true, principal: { principalId: 'user_1', ownerProvider: 'clerk', ownerId: 'user_1' } })
  },
  helpers: {
    randomString: () => 'x',
    generateCodeChallenge: async () => 'x',
    buildOAuthUrl: () => 'https://example.com',
    exchangeCodeForToken: async () => ({ access_token: 'x' }),
    getUserProfile: async () => ({ id: 'u_1', name: 'User' }),
    getOwnerDisplay: () => 'User',
    computeVerificationLevel: () => 'basic',
    computeBadge: () => '🤝 verified',
  },
}

describe('L0VerificationUseCases clerk mode', () => {
  it('disables legacy /verify start', async () => {
    const uc = new L0VerificationUseCases({ ...deps, identityMode: 'clerk' })
    const res = await uc.startVerification({ agentId: 'a', provider: 'google' })
    expect(res.status).toBe(410)
    expect(res.body.error).toBe('identity_provider_clerk_mode')
  })

  it('disables legacy /callback complete', async () => {
    const uc = new L0VerificationUseCases({ ...deps, identityMode: 'clerk' })
    const res = await uc.completeVerification({ code: 'x', state: 'y' })
    expect(res.status).toBe(410)
    expect(res.body.error).toBe('identity_provider_clerk_mode')
  })

  it('denies when clerk principal is not linked to agent', async () => {
    const uc = new L0VerificationUseCases({
      ...deps,
      identityMode: 'clerk',
      identityStore: {
        ...deps.identityStore,
        getActiveLinkageByAgentIdAndOwner: async () => null,
      }
    })

    const res = await uc.verifyAgent({ agentId: 'agent_1', authorizationHeader: 'Bearer token' })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('security_identity_claim_missing')
  })

  it('allows when clerk principal is linked to agent', async () => {
    const uc = new L0VerificationUseCases({
      ...deps,
      identityMode: 'clerk',
      identityStore: {
        ...deps.identityStore,
        getActiveLinkageByAgentIdAndOwner: async () => ({
          id: 'l1',
          agentId: 'agent_1',
          ownerProvider: 'clerk',
          ownerId: 'user_1',
          ownerDisplayName: null,
          privacyLevel: 'full',
          verifiedAt: new Date().toISOString(),
          revokedAt: null,
        }),
        getActiveLinkageWithTrustByAgentId: async () => ({
          linkage: {
            id: 'l1',
            agentId: 'agent_1',
            ownerProvider: 'clerk',
            ownerId: 'user_1',
            ownerDisplayName: null,
            privacyLevel: 'full',
            verifiedAt: new Date().toISOString(),
            revokedAt: null,
          },
          trust: {
            agentsOwned: 1,
            offersPublished: 0,
            successfulTrades: 0,
            reputationScore: 0,
          }
        })
      }
    })

    const res = await uc.verifyAgent({ agentId: 'agent_1', authorizationHeader: 'Bearer token' })
    expect(res.status).toBe(200)
    expect(res.body.verified).toBe(true)
    expect(res.body.identity_source).toBe('clerk')
  })
})
