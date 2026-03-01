import { Hono } from 'hono'
import type { AppEnv, Bindings } from '../core/types'
import { createL0UseCases } from '../core/identity'

export const systemRoutes = new Hono<AppEnv>()

// Health check
systemRoutes.get('/', (c) => {
  return c.json({
    name: 'Handshake API',
    version: '0.1.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
  })
})

// Well-known endpoints
systemRoutes.get('/.well-known/handshake.json', async (c) => {
  const publicKey = c.env.JWT_PUBLIC_KEY
  const keyId = c.env.JWT_KEY_ID || 'key-1'

  if (!publicKey) {
    return c.json({ status: 'error', error: 'key_not_configured' }, 500)
  }

  const keyBuffer = Uint8Array.from(atob(publicKey), (ch) => ch.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'spki',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['verify'],
  )
  const jwk = await crypto.subtle.exportKey('jwk', cryptoKey) as JsonWebKey

  return c.json({
    version: '1.0',
    issuer: c.env.ENVIRONMENT === 'production' ? 'https://handshake.dev' : 'http://localhost:8787',
    keys: [{
      kid: keyId,
      kty: jwk.kty,
      use: 'sig',
      alg: 'RS256',
      n: jwk.n,
      e: jwk.e,
    }],
    verification_endpoint: '/verify/:agent_id',
    refresh_endpoint: '/refresh',
    jwks_uri: '/.well-known/jwks.json',
    architecture: {
      online_verification: 'GET /verify/:agent_id - Database lookup with trust signals and real-time revocation',
      offline_verification: 'JWT signature verification - Fast, no network, no trust signals',
      credential_lifetime: '24 hours',
      refresh_mechanism: 'POST /refresh with current JWT to get new credential',
    },
  })
})

systemRoutes.get('/.well-known/jwks.json', async (c) => {
  const publicKey = c.env.JWT_PUBLIC_KEY
  const keyId = c.env.JWT_KEY_ID || 'key-1'

  if (!publicKey) {
    return c.json({ status: 'error', error: 'key_not_configured' }, 500)
  }

  const keyBuffer = Uint8Array.from(atob(publicKey), (ch) => ch.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'spki',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['verify'],
  )
  const jwk = await crypto.subtle.exportKey('jwk', cryptoKey) as JsonWebKey

  return c.json({
    keys: [{
      kid: keyId,
      kty: jwk.kty,
      use: 'sig',
      alg: 'RS256',
      n: jwk.n,
      e: jwk.e,
    }],
  })
})

// Verification endpoints
systemRoutes.get('/verify', async (c) => {
  const result = await createL0UseCases(c.env).startVerification({
    agentId: c.req.query('agent_id'),
    provider: c.req.query('provider'),
    privacyLevel: c.req.query('privacy_level') || 'full',
  })

  return c.json(result.body, result.status as any)
})

systemRoutes.get('/callback', async (c) => {
  const result = await createL0UseCases(c.env).completeVerification({
    code: c.req.query('code'),
    state: c.req.query('state'),
    oauthError: c.req.query('error'),
  })

  return c.json(result.body, result.status as any)
})

systemRoutes.get('/verify/:agent_id', async (c) => {
  const result = await createL0UseCases(c.env).verifyAgent({
    agentId: c.req.param('agent_id'),
    authorizationHeader: c.req.header('Authorization'),
  })

  return c.json(result.body, result.status as any)
})

systemRoutes.post('/refresh', async (c) => {
  const result = await createL0UseCases(c.env).refreshCredential({
    authorizationHeader: c.req.header('Authorization'),
  })

  return c.json(result.body, result.status as any)
})

systemRoutes.post('/verify-credential', async (c) => {
  const body = await c.req.json()

  const result = await createL0UseCases(c.env).verifyCredentialOffline({
    credential: body?.credential,
  })

  return c.json(result.body, result.status as any)
})
