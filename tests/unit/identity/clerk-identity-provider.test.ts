import { describe, it, expect } from 'vitest'
import { ClerkIdentityProvider } from '@/adapters/identity/clerk-identity-provider'

describe('ClerkIdentityProvider', () => {
  it('fails when identity provider is not configured', async () => {
    const provider = new ClerkIdentityProvider({})
    const out = await provider.verifyAuthorizationHeader('Bearer token')
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reasonCode).toBe('security_identity_provider_not_configured')
  })

  it('fails for missing auth header', async () => {
    const provider = new ClerkIdentityProvider({ jwtKey: 'x' })
    const out = await provider.verifyAuthorizationHeader(undefined)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reasonCode).toBe('security_missing_authorization_header')
  })
})
