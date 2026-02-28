import { describe, it, expect } from 'vitest'
import { L0VerificationUseCases } from '@/use-cases/l0-verification'

const deps: any = {
  identityStore: {
    getActiveLinkageByAgentId: async () => null,
    getActiveLinkageWithTrustByAgentId: async () => null,
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
})
