import { D1IdentityStore } from '../adapters/persistence/d1-identity-store'
import { KvStateStore } from '../adapters/persistence/kv-state-store'
import { JwtCredentialService } from '../adapters/crypto/jwt-credential-service'
import { L0VerificationUseCases } from '../use-cases/l0-verification'
import { ClerkIdentityProvider } from '../adapters/identity/clerk-identity-provider'
import type { Bindings } from './types'

export function validateIdentityConfig(env: Bindings): void {
  const mode = env.IDENTITY_PROVIDER ?? 'legacy'
  if (mode !== 'clerk') return

  if (!env.CLERK_JWT_KEY && !env.CLERK_SECRET_KEY) {
    throw new Error('Clerk mode requires CLERK_JWT_KEY or CLERK_SECRET_KEY')
  }

  if (!env.CLERK_AUTHORIZED_PARTIES || !env.CLERK_AUTHORIZED_PARTIES.trim()) {
    throw new Error('Clerk mode requires CLERK_AUTHORIZED_PARTIES')
  }
}

export function createL0UseCases(env: Bindings): L0VerificationUseCases {
  validateIdentityConfig(env)
  return new L0VerificationUseCases({
    identityStore: new D1IdentityStore(env.DB),
    stateStore: new KvStateStore(env.KV),
    credentialService: new JwtCredentialService({
      environment: env.ENVIRONMENT,
      privateKey: env.JWT_PRIVATE_KEY,
      publicKey: env.JWT_PUBLIC_KEY,
      keyId: env.JWT_KEY_ID,
    }),
    helpers: {
      randomString: generateRandomString,
      generateCodeChallenge,
      buildOAuthUrl: (provider, state, codeChallenge) => buildOAuthUrl(provider, state, codeChallenge, env),
      exchangeCodeForToken: (provider, code, codeVerifier) => exchangeCodeForToken(provider, code, codeVerifier, env),
      getUserProfile,
      getOwnerDisplay,
      computeVerificationLevel,
      computeBadge,
    },
    identityMode: env.IDENTITY_PROVIDER ?? 'legacy',
    identityProvider: new ClerkIdentityProvider({
      jwtKey: env.CLERK_JWT_KEY,
      secretKey: env.CLERK_SECRET_KEY,
      audience: env.CLERK_AUDIENCE,
      authorizedParties: env.CLERK_AUTHORIZED_PARTIES
        ? env.CLERK_AUTHORIZED_PARTIES.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    }),
  })
}

// Helpers copied from index.ts to keep behavior unchanged for structural refactor
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function base64UrlEncode(data: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

function buildOAuthUrl(provider: string, state: string, codeChallenge: string, env: Bindings): string {
  const redirectUri = env.ENVIRONMENT === 'production'
    ? 'https://handshake.dev/callback'
    : 'http://localhost:8787/callback';

  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent'
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  if (provider === 'github') {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

async function exchangeCodeForToken(provider: string, code: string, codeVerifier: string, env: Bindings): Promise<{ accessToken: string; refreshToken?: string }> {
  const redirectUri = env.ENVIRONMENT === 'production'
    ? 'https://handshake.dev/callback'
    : 'http://localhost:8787/callback';

  if (provider === 'google') {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) throw new Error(`Token exchange failed: ${response.statusText}`);
    const data: any = await response.json();
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  if (provider === 'github') {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) throw new Error(`Token exchange failed: ${response.statusText}`);
    const data: any = await response.json();
    return { accessToken: data.access_token };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

async function getUserProfile(provider: string, accessToken: string): Promise<any> {
  if (provider === 'google') {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error('Failed to get Google profile');
    return response.json();
  }

  if (provider === 'github') {
    const profileRes = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'User-Agent': 'Handshake/0.1.0' }
    });
    if (!profileRes.ok) throw new Error('Failed to get GitHub profile');
    const profile: any = await profileRes.json();

    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'User-Agent': 'Handshake/0.1.0' }
    });
    if (emailsRes.ok) {
      const emails: any[] = await emailsRes.json();
      const primaryEmail = emails.find(e => e.primary)?.email || emails[0]?.email;
      if (primaryEmail) profile.email = primaryEmail;
    }

    return profile;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

function getOwnerDisplay(linkage: any): string {
  return linkage.owner_display_name || linkage.owner_id || 'Verified Owner';
}

function computeVerificationLevel(linkage: any): string {
  const score = linkage.reputation_score || 0;
  if (score >= 90) return 'premium';
  if (score >= 50) return 'standard';
  return 'basic';
}

function computeBadge(linkage: any): string {
  const level = computeVerificationLevel(linkage);
  if (level === 'premium') return '🌟 premium verified';
  if (level === 'standard') return '✅ verified';
  return '🤝 verified';
}
