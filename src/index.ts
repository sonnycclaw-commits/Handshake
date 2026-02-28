import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { D1IdentityStore } from './adapters/persistence/d1-identity-store';
import { KvStateStore } from './adapters/persistence/kv-state-store';
import { JwtCredentialService } from './adapters/crypto/jwt-credential-service';
import { L0VerificationUseCases } from './use-cases/l0-verification';

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  ENVIRONMENT: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  JWT_PRIVATE_KEY: string;
  JWT_PUBLIC_KEY: string;
  JWT_KEY_ID: string;
};

const app = new Hono<{ Bindings: Bindings }>();


function createL0UseCases(env: Bindings): L0VerificationUseCases {
  return new L0VerificationUseCases({
    identityStore: new D1IdentityStore(env.DB),
    stateStore: new KvStateStore(env.KV),
    credentialService: new JwtCredentialService({
      environment: env.ENVIRONMENT,
      privateKey: env.JWT_PRIVATE_KEY,
      publicKey: env.JWT_PUBLIC_KEY,
      keyId: env.JWT_KEY_ID
    }),
    helpers: {
      randomString: generateRandomString,
      generateCodeChallenge,
      buildOAuthUrl: (provider, state, codeChallenge) => buildOAuthUrl(provider, state, codeChallenge, env),
      exchangeCodeForToken: (provider, code, codeVerifier) => exchangeCodeForToken(provider, code, codeVerifier, env),
      getUserProfile,
      getOwnerDisplay,
      computeVerificationLevel,
      computeBadge
    }
  });
}

// Middleware
app.use('*', logger());
app.use('*', cors());

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'Handshake API',
    version: '0.1.0',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// ====================
// ARCHITECTURE
// ====================
// 
// This API implements a hybrid verification architecture:
//
// 1. DATABASE (Source of Truth)
//    - Identity records (linkages table)
//    - Revocation status (revoked_at field)
//    - Trust signals (agents_owned, successful_trades, reputation_score)
//    - Real-time queries
//
// 2. JWT (Presentation Layer)
//    - Short-lived credentials (24 hours)
//    - Portable, offline verification
//    - No trust signals (use database for those)
//    - Refreshable via /refresh endpoint
//
// USE CASES:
// - High-value / high-risk → Call GET /verify/:agent_id (database lookup)
// - Low-latency / offline → Verify JWT signature locally
//
// ====================

// ====================
// WELL-KNOWN ENDPOINTS
// ====================

app.get('/.well-known/handshake.json', async (c) => {
  const publicKey = c.env.JWT_PUBLIC_KEY;
  const keyId = c.env.JWT_KEY_ID || 'key-1';
  
  if (!publicKey) {
    return c.json({ status: 'error', error: 'key_not_configured' }, 500);
  }

  const keyBuffer = Uint8Array.from(atob(publicKey), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'spki',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['verify']
  );
  const jwk = await crypto.subtle.exportKey('jwk', cryptoKey) as JsonWebKey;

  return c.json({
    version: '1.0',
    issuer: c.env.ENVIRONMENT === 'production' ? 'https://handshake.dev' : 'http://localhost:8787',
    keys: [{
      kid: keyId,
      kty: jwk.kty,
      use: 'sig',
      alg: 'RS256',
      n: jwk.n,
      e: jwk.e
    }],
    verification_endpoint: '/verify/:agent_id',
    refresh_endpoint: '/refresh',
    jwks_uri: '/.well-known/jwks.json',
    architecture: {
      online_verification: 'GET /verify/:agent_id - Database lookup with trust signals and real-time revocation',
      offline_verification: 'JWT signature verification - Fast, no network, no trust signals',
      credential_lifetime: '24 hours',
      refresh_mechanism: 'POST /refresh with current JWT to get new credential'
    }
  });
});

app.get('/.well-known/jwks.json', async (c) => {
  const publicKey = c.env.JWT_PUBLIC_KEY;
  const keyId = c.env.JWT_KEY_ID || 'key-1';
  
  if (!publicKey) {
    return c.json({ status: 'error', error: 'key_not_configured' }, 500);
  }

  const keyBuffer = Uint8Array.from(atob(publicKey), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'spki',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['verify']
  );
  const jwk = await crypto.subtle.exportKey('jwk', cryptoKey) as JsonWebKey;

  return c.json({
    keys: [{
      kid: keyId,
      kty: jwk.kty,
      use: 'sig',
      alg: 'RS256',
      n: jwk.n,
      e: jwk.e
    }]
  });
});

// ====================
// VERIFICATION ENDPOINTS
// ====================

app.get('/verify', async (c) => {
  const result = await createL0UseCases(c.env).startVerification({
    agentId: c.req.query('agent_id'),
    provider: c.req.query('provider'),
    privacyLevel: c.req.query('privacy_level') || 'full'
  });

  return c.json(result.body, result.status as any);
});

app.get('/callback', async (c) => {
  const result = await createL0UseCases(c.env).completeVerification({
    code: c.req.query('code'),
    state: c.req.query('state'),
    oauthError: c.req.query('error')
  });

  return c.json(result.body, result.status as any);
});

// ONLINE VERIFICATION: Database lookup with trust signals and real-time revocation
// Use for: High-value transactions, sensitive operations, when you need trust signals
app.get('/verify/:agent_id', async (c) => {
  const result = await createL0UseCases(c.env).verifyAgent({
    agentId: c.req.param('agent_id'),
    authorizationHeader: c.req.header('Authorization')
  });

  return c.json(result.body, result.status as any);
});

// REFRESH: Re-issue JWT if database says still valid
// Use when: Credential expiring, need fresh token, want to confirm revocation status
app.post('/refresh', async (c) => {
  const result = await createL0UseCases(c.env).refreshCredential({
    authorizationHeader: c.req.header('Authorization')
  });

  return c.json(result.body, result.status as any);
});

// OFFLINE VERIFICATION: Verify JWT signature without database lookup
// Use for: Low-latency, offline scenarios, when trust signals aren't needed
app.post('/verify-credential', async (c) => {
  const body = await c.req.json();

  const result = await createL0UseCases(c.env).verifyCredentialOffline({
    credential: body?.credential
  });

  return c.json(result.body, result.status as any);
});

// ====================
// OAUTH HELPERS
// ====================


function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function buildOAuthUrl(provider: string, state: string, codeChallenge: string, env: Bindings): string {
  const redirectUri = `${env.ENVIRONMENT === 'production' ? 'https://handshake.dev' : 'http://localhost:8787'}/callback`;

  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  if (provider === 'github') {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
      allow_signup: 'true'
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  throw new Error('Invalid provider');
}

async function exchangeCodeForToken(provider: string, code: string, codeVerifier: string, env: Bindings): Promise<any> {
  const redirectUri = `${env.ENVIRONMENT === 'production' ? 'https://handshake.dev' : 'http://localhost:8787'}/callback`;

  if (provider === 'google') {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    return response.json();
  }

  if (provider === 'github') {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri
      })
    });
    return response.json();
  }

  throw new Error('Invalid provider');
}

async function getUserProfile(provider: string, accessToken: string): Promise<any> {
  if (provider === 'google') {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data: any = await response.json();
    return { id: data.id, name: data.name, email: data.email };
  }

  if (provider === 'github') {
    const response = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data: any = await response.json();
    return { id: String(data.id), name: data.login, email: data.email };
  }

  throw new Error('Invalid provider');
}

function getOwnerDisplay(linkage: any): string {
  if (linkage.privacy_level === 'anonymous') return 'Verified Owner';
  if (linkage.privacy_level === 'pseudonymous') return linkage.owner_pseudonym || 'Anonymous';
  return linkage.owner_display_name || 'Verified Owner';
}

function computeVerificationLevel(linkage: any): string {
  const trades = linkage.successful_trades || 0;
  const reputation = linkage.reputation_score || 0;
  if (trades >= 50 && reputation >= 0.9) return 'trusted';
  if (trades >= 10) return 'confirmed';
  return 'basic';
}

function computeBadge(linkage: any): string {
  const level = computeVerificationLevel(linkage);
  if (level === 'trusted') return '🤝★ trusted';
  if (level === 'confirmed') return '🤝✓ confirmed';
  return '🤝 verified';
}

export default app;