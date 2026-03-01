import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { D1IdentityStore } from './adapters/persistence/d1-identity-store';
import { KvStateStore } from './adapters/persistence/kv-state-store';
import { JwtCredentialService } from './adapters/crypto/jwt-credential-service';
import { L0VerificationUseCases } from './use-cases/l0-verification';
import { ClerkIdentityProvider } from './adapters/identity/clerk-identity-provider';
import { D1RequestWorkflowStore } from './adapters/persistence/d1-request-workflow-store';
import { computeMetricsSummary, METRICS_PROJECTOR_VERSION, METRICS_SCHEMA_VERSION } from './domain/services/wf5-metrics-projector';
import { D1HITLStore } from './adapters/persistence/d1-hitl-store';
import { setHITLStore } from './domain/services/hitl-workflow';
import { classifyReasonCode, toResponseClass } from './domain/constants/reason-codes';
import { setRequestWorkflowStore, submitRequest, resolveRequestHitl, getRequestAudit, getRequestLineage, authorizePrivilegedExecution } from './domain/services/request-workflow';
import type { RequestInput } from './domain/services/request-workflow-types';
import { createPolicyDraft, simulatePolicy, publishPolicy } from './domain/services/policy-management';

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
  IDENTITY_PROVIDER?: 'legacy' | 'clerk';
  CLERK_JWT_KEY?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_AUDIENCE?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

function validateIdentityConfig(env: Bindings): void {
  const mode = env.IDENTITY_PROVIDER ?? 'legacy'
  if (mode !== 'clerk') return

  if (!env.CLERK_JWT_KEY && !env.CLERK_SECRET_KEY) {
    throw new Error('Clerk mode requires CLERK_JWT_KEY or CLERK_SECRET_KEY')
  }

  if (!env.CLERK_AUTHORIZED_PARTIES || !env.CLERK_AUTHORIZED_PARTIES.trim()) {
    throw new Error('Clerk mode requires CLERK_AUTHORIZED_PARTIES')
  }
}




function configureWorkflowStores(env: Bindings): D1RequestWorkflowStore {
  const requestStore = new D1RequestWorkflowStore(env.DB)
  setRequestWorkflowStore(requestStore)
  setHITLStore(new D1HITLStore(env.DB))
  return requestStore
}

function mapTierToRiskTier(tier: number): 'low' | 'medium' | 'high' | 'critical' | 'unknown' {
  if (!Number.isFinite(tier)) return 'unknown'
  if (tier >= 4) return 'critical'
  if (tier >= 3) return 'high'
  if (tier >= 2) return 'medium'
  return 'low'
}

function maxNumericTimestamp(values: unknown[]): number | undefined {
  let max = Number.NEGATIVE_INFINITY
  for (const v of values) {
    const n = Number(v)
    if (Number.isFinite(n) && n > max) max = n
  }
  if (!Number.isFinite(max)) return undefined
  return max
}

function statusForReasonCode(reasonCode: string): 400 | 401 | 403 | 404 | 409 | 422 {
  const family = classifyReasonCode(reasonCode)
  if (family === 'trust_context') return 400
  if (reasonCode.includes('not_found')) return 404
  if (reasonCode === 'security_missing_authorization_header' || reasonCode === 'security_token_invalid') return 401
  if (reasonCode.includes('unauthorized')) return 403
  if (reasonCode.includes('terminal_state') || reasonCode.includes('mismatch')) return 409
  if (family === 'security') return 403
  if (family === 'policy') return 422
  return 400
}

function toStructuredError(reasonCode: string, message: string) {
  return {
    status: 'error' as const,
    error: reasonCode,
    reasonCode,
    responseClass: toResponseClass({ decision: 'deny', reasonCode }),
    message,
  }
}

function isActionType(value: unknown): value is RequestInput['actionType'] {
  return value === 'payment' || value === 'data_access' || value === 'credential_use' || value === 'external_call' || value === 'other'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseBearerPrincipal(header?: string): { ok: true; ownerId: string } | { ok: false; reasonCode: string; message: string } {
  if (!header || !header.startsWith('Bearer ')) {
    return { ok: false, reasonCode: 'security_missing_authorization_header', message: 'Authorization header required' }
  }

  const token = header.slice(7).trim()
  const parts = token.split(':')
  if (parts.length !== 2 || parts[0] !== 'principal' || !parts[1]) {
    return { ok: false, reasonCode: 'security_token_invalid', message: 'Authorization token format invalid (expected Bearer principal:<ownerId>)' }
  }

  return { ok: true, ownerId: parts[1] }
}

type PolicyScope = 'global' | 'agent'
type PolicyRuleValue = string | number | boolean

type PolicyRule = {
  id: string
  key: string
  value: PolicyRuleValue
}

type EntityTrustState = 'established' | 'watch' | 'restricted' | 'unknown'

type EntityStatus = 'active' | 'restricted' | 'suspended' | 'archived'

type EntityRow = {
  entity_id: string
  entity_type: string
  display_name: string
  legal_name?: string | null
  owner_principal_id: string
  status: EntityStatus
  trust_state: EntityTrustState
  exposure_score: number
  created_at: number
  updated_at: number
}

function normalizeEntityType(value: unknown): string {
  const raw = String(value ?? '').trim()
  return raw.length > 0 ? raw : 'other'
}

function normalizeEntityStatus(value: unknown): EntityStatus {
  const v = String(value ?? '').toLowerCase()
  if (v === 'active' || v === 'restricted' || v === 'suspended' || v === 'archived') return v
  return 'active'
}

function normalizeEntityTrustState(value: unknown): EntityTrustState {
  const v = String(value ?? '').toLowerCase()
  if (v === 'established' || v === 'watch' || v === 'restricted' || v === 'unknown') return v
  return 'unknown'
}

function isPolicyScope(value: unknown): value is PolicyScope {
  return value === 'global' || value === 'agent'
}

function isPolicyRuleValue(value: unknown): value is PolicyRuleValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function isPolicyRule(value: unknown): value is PolicyRule {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.key === 'string'
    && isPolicyRuleValue(value.value)
}

function normalizeScopeId(scope: PolicyScope, scopeId?: string): string {
  if (scope === 'global') return '__global__'
  return String(scopeId ?? '').trim()
}

function denormalizeScopeId(scope: PolicyScope, scopeId: string): string | undefined {
  if (scope === 'global') return undefined
  return scopeId
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function toPolicyShapeFromRules(rules: PolicyRule[]): {
  maxTransaction?: number
  dailySpendLimit?: number
  allowedHours?: string
  allowedCategories?: string[]
} {
  const policy: {
    maxTransaction?: number
    dailySpendLimit?: number
    allowedHours?: string
    allowedCategories?: string[]
  } = {}

  for (const rule of rules) {
    const key = rule.key.trim().toLowerCase()
    const value = rule.value

    if ((key === 'max_transaction' || key === 'maxtransaction' || key === 'max_payment') && typeof value === 'number') {
      policy.maxTransaction = value
      continue
    }

    if ((key === 'daily_spend_limit' || key === 'dailyspendlimit') && typeof value === 'number') {
      policy.dailySpendLimit = value
      continue
    }

    if (key === 'allowed_hours' && typeof value === 'string') {
      policy.allowedHours = value
      continue
    }

    if (key === 'allowed_categories') {
      if (typeof value === 'string') {
        policy.allowedCategories = value.split(',').map((v) => v.trim()).filter(Boolean)
      }
      continue
    }
  }

  return policy
}

function parsePolicyConfigBody(body: unknown): { ok: true; scope: PolicyScope; scopeIdNormalized: string; scopeIdDisplay?: string; rules: PolicyRule[] } | { ok: false; reasonCode: string; message: string } {
  if (!isRecord(body)) {
    return { ok: false, reasonCode: 'trust_context_invalid_request_shape', message: 'Request body must be an object' }
  }

  const scopeRaw = body.scope
  if (!isPolicyScope(scopeRaw)) {
    return { ok: false, reasonCode: 'trust_context_invalid_request_shape', message: 'scope must be global|agent' }
  }

  const scope = scopeRaw
  const scopeIdInput = typeof body.scopeId === 'string' ? body.scopeId.trim() : undefined
  const scopeIdNormalized = normalizeScopeId(scope, scopeIdInput)

  if (scope === 'agent' && !scopeIdNormalized) {
    return { ok: false, reasonCode: 'trust_context_missing_binding', message: 'scopeId is required for agent scope' }
  }

  const rulesRaw = body.rules
  if (!Array.isArray(rulesRaw)) {
    return { ok: false, reasonCode: 'trust_context_invalid_request_shape', message: 'rules must be an array' }
  }

  const rules: PolicyRule[] = []
  for (const r of rulesRaw) {
    if (!isPolicyRule(r)) {
      return { ok: false, reasonCode: 'trust_context_invalid_request_shape', message: 'each rule must include id,key,value' }
    }
    rules.push({ id: r.id, key: r.key, value: r.value })
  }

  return {
    ok: true,
    scope,
    scopeIdNormalized,
    scopeIdDisplay: denormalizeScopeId(scope, scopeIdNormalized),
    rules,
  }
}

function createL0UseCases(env: Bindings): L0VerificationUseCases {
  validateIdentityConfig(env)
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
    },
    identityMode: env.IDENTITY_PROVIDER ?? 'legacy',
    identityProvider: new ClerkIdentityProvider({
      jwtKey: env.CLERK_JWT_KEY,
      secretKey: env.CLERK_SECRET_KEY,
      audience: env.CLERK_AUDIENCE,
      authorizedParties: env.CLERK_AUTHORIZED_PARTIES
        ? env.CLERK_AUTHORIZED_PARTIES.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    })
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
// WORKFLOW TRANSPORT ENDPOINTS (WF5-API-01)
// ====================

app.post('/workflow/requests', async (c) => {
  const store = configureWorkflowStores(c.env)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'Invalid JSON body'), statusForReasonCode('trust_context_invalid_request_shape'))
  }

  if (!isRecord(body)) {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'Request body must be an object'), statusForReasonCode('trust_context_invalid_request_shape'))
  }

  if (!isActionType(body.actionType)) {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'actionType is invalid or missing'), 400)
  }

  const input: RequestInput = {
    requestId: String(body.requestId ?? ''),
    principalId: String(body.principalId ?? ''),
    agentId: String(body.agentId ?? ''),
    actionType: body.actionType,
    payloadRef: String(body.payloadRef ?? ''),
    timestamp: Number(body.timestamp ?? Date.now()),
    privilegedPath: body.privilegedPath === false ? false : true,
    context: isRecord(body.context) ? body.context : undefined,
  }

  const result = await submitRequest(input)

  const persisted = await store.getRequest(result.requestId)
  const state = persisted?.state ?? (result.decision === 'escalate' ? 'escalated_pending' : result.decision === 'allow' ? 'allowed_terminal' : 'denied_terminal')

  const validationOrSecurityDeny = result.decision === 'deny' && (
    classifyReasonCode(result.reasonCode) === 'trust_context' ||
    result.reasonCode === 'security_handshake_required_bypass_denied' ||
    result.reasonCode === 'security_side_channel_denied'
  )

  if (validationOrSecurityDeny) {
    return c.json({
      ...toStructuredError(result.reasonCode, 'Request denied at workflow boundary'),
      requestId: result.requestId,
      decision: result.decision,
      tier: result.tier,
      decisionContextHash: result.decisionContextHash,
      state,
    }, statusForReasonCode(result.reasonCode))
  }

  return c.json({
    ...result,
    state,
  })
})

app.get('/workflow/requests/:requestId', async (c) => {
  const store = configureWorkflowStores(c.env)
  const requestId = c.req.param('requestId')
  const record = await store.getRequest(requestId)

  if (!record) {
    return c.json(toStructuredError('hitl_request_not_found', 'Request not found'), statusForReasonCode('hitl_request_not_found'))
  }

  return c.json({
    requestId: record.requestId,
    principalId: record.principalId,
    agentId: record.agentId,
    actionType: record.actionType,
    payloadRef: record.payloadRef,
    state: record.state,
    terminal: record.terminal,
    decisionContextHash: record.decisionContextHash,
    artifact: record.result,
    hitlRequestId: record.hitlRequestId,
  })
})

app.get('/workflow/decision-room/:requestId', async (c) => {
  const store = configureWorkflowStores(c.env)
  const requestId = c.req.param('requestId')
  const record = await store.getRequest(requestId)

  if (!record) {
    return c.json(toStructuredError('hitl_request_not_found', 'Decision context not found'), statusForReasonCode('hitl_request_not_found'))
  }

  const artifact = record.result
  const riskTier = mapTierToRiskTier(artifact.tier)
  const reasonFamily = classifyReasonCode(artifact.reasonCode)

  let expiresAt: number | undefined
  if (record.hitlRequestId) {
    const hitl = await new D1HITLStore(c.env.DB).get(record.hitlRequestId)
    expiresAt = hitl?.expiresAt
  }

  return c.json({
    requestId: record.requestId,
    agentId: record.agentId,
    principalId: record.principalId,
    riskTier,
    reasonFamily,
    artifact,
    ...(typeof expiresAt === 'number' ? { expiresAt } : {}),
  })
})

app.post('/workflow/decision-room/action', async (c) => {
  configureWorkflowStores(c.env)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'Invalid JSON body'), statusForReasonCode('trust_context_invalid_request_shape'))
  }

  if (!isRecord(body)) {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'Request body must be an object'), statusForReasonCode('trust_context_invalid_request_shape'))
  }

  const requestId = String(body.requestId ?? '')
  const actionRaw = String(body.action ?? '').toLowerCase()
  const mappedAction = actionRaw === 'deny' ? 'reject' : actionRaw

  if (!requestId) {
    return c.json(toStructuredError('trust_context_missing_binding', 'requestId is required'), statusForReasonCode('trust_context_missing_binding'))
  }

  if (mappedAction !== 'approve' && mappedAction !== 'reject') {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'action must be approve|reject'), statusForReasonCode('trust_context_invalid_request_shape'))
  }

  const store = new D1RequestWorkflowStore(c.env.DB)
  const existing = await store.getRequest(requestId)
  const hitlRequestId = String(body.hitlRequestId ?? existing?.hitlRequestId ?? '')

  if (!hitlRequestId) {
    return c.json(toStructuredError('hitl_request_not_found', 'No HITL request is associated with this request'), statusForReasonCode('hitl_request_not_found'))
  }

  let approverId: string | undefined
  if (mappedAction === 'approve') {
    const principal = parseBearerPrincipal(c.req.header('Authorization'))
    if (!principal.ok) {
      return c.json(toStructuredError(principal.reasonCode, principal.message), statusForReasonCode(principal.reasonCode))
    }
    approverId = principal.ownerId
  }

  const result = await resolveRequestHitl({
    requestId,
    hitlRequestId,
    decision: mappedAction,
    timestamp: Date.now(),
    approverId,
  })

  const actionSucceeded =
    (mappedAction === 'approve' && result.reasonCode === 'hitl_approved') ||
    (mappedAction === 'reject' && result.reasonCode === 'hitl_rejected')

  if (!actionSucceeded) {
    return c.json({
      ...toStructuredError(result.reasonCode, 'Decision action rejected by workflow invariants'),
      requestId: result.requestId,
      decision: result.decision,
      artifact: result,
    }, statusForReasonCode(result.reasonCode))
  }

  return c.json({
    status: 'ok',
    requestId: result.requestId,
    decision: result.decision,
    reasonCode: result.reasonCode,
    artifact: result,
  })
})


app.post('/workflow/authorize-execution', async (c) => {
  configureWorkflowStores(c.env)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'Invalid JSON body'), statusForReasonCode('trust_context_invalid_request_shape'))
  }

  if (!isRecord(body) || !isRecord(body.request)) {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'request object is required'), statusForReasonCode('trust_context_invalid_request_shape'))
  }

  const req = body.request
  if (!isActionType(req.actionType)) {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'request.actionType is invalid'), statusForReasonCode('trust_context_invalid_request_shape'))
  }

  const request: RequestInput = {
    requestId: String(req.requestId ?? ''),
    principalId: String(req.principalId ?? ''),
    agentId: String(req.agentId ?? ''),
    actionType: req.actionType,
    payloadRef: String(req.payloadRef ?? ''),
    timestamp: Number(req.timestamp ?? Date.now()),
    privilegedPath: req.privilegedPath === false ? false : true,
    context: isRecord(req.context) ? req.context : undefined,
  }

  const gate = await authorizePrivilegedExecution({
    request,
    artifact: (body as Record<string, unknown>).artifact as any,
  })

  if (!gate.allowed) {
    return c.json({
      ...toStructuredError(gate.reasonCode, 'Privileged execution denied'),
      allowed: false,
    }, statusForReasonCode(gate.reasonCode))
  }

  return c.json({
    status: 'ok',
    allowed: true,
    reasonCode: gate.reasonCode,
    responseClass: toResponseClass({ decision: 'allow', reasonCode: gate.reasonCode }),
  })
})

app.get('/workflow/evidence/:requestId', async (c) => {
  configureWorkflowStores(c.env)
  const requestId = c.req.param('requestId')

  const [audit, lineage] = await Promise.all([
    getRequestAudit(requestId),
    getRequestLineage(requestId),
  ])

  const events = [
    ...audit.map((event, idx) => ({ id: `audit_${idx}`, requestId, source: 'audit' as const, event })),
    ...lineage.map((event, idx) => ({ id: `lineage_${idx}`, requestId, source: 'lineage' as const, event })),
  ]
    .map((row) => ({
      id: row.id,
      requestId: row.requestId,
      timestamp: Number((row.event as any).timestamp ?? 0),
      reasonCode: String((row.event as any).reasonCode ?? 'unknown'),
      payload: {
        source: row.source,
        ...(row.event as Record<string, unknown>),
      },
    }))
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))

  return c.json(events)
})






// ====================
// AGENTS RAIL ENDPOINTS (WF5-API-04.1/04.2)
// ====================

app.get('/agents', async (c) => {
  const store = configureWorkflowStores(c.env)

  type LinkageRow = {
    agent_id: string
    revoked_at?: string | null
  }

  const linkages = await c.env.DB.prepare(
    `SELECT agent_id, revoked_at FROM linkages`
  ).all<LinkageRow>()

  const agents = [] as Array<{
    agentId: string
    riskTier: 'low' | 'medium' | 'high' | 'critical' | 'unknown'
    status: string
    lastDecisionAt?: number
    driftScore?: number
  }>

  for (const row of (linkages.results ?? [])) {
    const agentId = String(row.agent_id)

    const records = await c.env.DB.prepare(
      `SELECT result_json, state, request_timestamp FROM request_workflow_requests WHERE agent_id = ? ORDER BY request_timestamp DESC LIMIT 50`
    ).bind(agentId).all<{ result_json: string; state: string; request_timestamp: number }>()

    const parsed = (records.results ?? []).map((r) => {
      try {
        return {
          state: r.state,
          requestTimestamp: r.request_timestamp,
          result: JSON.parse(r.result_json) as { tier?: number; timestamp?: number }
        }
      } catch {
        return {
          state: r.state,
          requestTimestamp: r.request_timestamp,
          result: {}
        }
      }
    })

    const latest = parsed[0]
    const riskTier = latest?.result?.tier !== undefined ? mapTierToRiskTier(Number(latest.result.tier)) : 'unknown'

    let status = 'stable'
    if (row.revoked_at) status = 'revoked'
    else if (latest?.state === 'escalated_pending') status = 'active'
    else if (riskTier === 'critical' || riskTier === 'high') status = 'active'

    const lastDecisionAt = maxNumericTimestamp(parsed.map((p) => p.result.timestamp ?? p.requestTimestamp))

    const total = parsed.length
    const escalations = parsed.filter((p) => p.state === 'escalated_pending' || p.state.startsWith('escalated_')).length
    const denies = parsed.filter((p) => p.state === 'denied_terminal' || p.state === 'escalated_rejected_terminal' || p.state === 'escalated_expired_terminal').length
    const driftScore = total > 0 ? Number(((escalations + denies) / total).toFixed(2)) : 0

    agents.push({
      agentId,
      riskTier,
      status,
      ...(typeof lastDecisionAt === 'number' ? { lastDecisionAt } : {}),
      driftScore,
    })
  }

  agents.sort((a, b) => {
    const order = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 } as const
    return order[b.riskTier] - order[a.riskTier] || a.agentId.localeCompare(b.agentId)
  })

  return c.json({ agents })
})

app.get('/agents/:agentId', async (c) => {
  const store = configureWorkflowStores(c.env)
  const agentId = c.req.param('agentId')

  type LinkageRow = { agent_id: string; revoked_at?: string | null }
  const linkage = await c.env.DB.prepare(
    `SELECT agent_id, revoked_at FROM linkages WHERE agent_id = ?`
  ).bind(agentId).first<LinkageRow>()

  if (!linkage) {
    return c.json(toStructuredError('hitl_request_not_found', 'Agent not found'), statusForReasonCode('hitl_request_not_found'))
  }

  const records = await c.env.DB.prepare(
    `SELECT request_id, state, request_timestamp, result_json FROM request_workflow_requests WHERE agent_id = ? ORDER BY request_timestamp DESC LIMIT 20`
  ).bind(agentId).all<{ request_id: string; state: string; request_timestamp: number; result_json: string }>()

  const parsed = (records.results ?? []).map((r) => {
    let result: any = {}
    try { result = JSON.parse(r.result_json) } catch { result = {} }
    return {
      requestId: r.request_id,
      state: r.state,
      requestTimestamp: r.request_timestamp,
      result,
    }
  })

  const latest = parsed[0]
  const riskTier = latest?.result?.tier !== undefined ? mapTierToRiskTier(Number(latest.result.tier)) : 'unknown'
  let status = 'stable'
  if (linkage.revoked_at) status = 'revoked'
  else if (latest?.state === 'escalated_pending') status = 'active'
  else if (riskTier === 'critical' || riskTier === 'high') status = 'active'

  const recentRequests = parsed.map((p) => ({
    requestId: p.requestId,
    timestamp: Number(p.result.timestamp ?? p.requestTimestamp),
    reasonCode: String(p.result.reasonCode ?? 'unknown'),
    decision: (p.result.decision === 'allow' || p.result.decision === 'deny' || p.result.decision === 'escalate') ? p.result.decision : 'deny',
  }))

  const total = parsed.length
  const escalations = parsed.filter((p) => p.state === 'escalated_pending' || p.state.startsWith('escalated_')).length
  const denies = parsed.filter((p) => p.state === 'denied_terminal' || p.state === 'escalated_rejected_terminal' || p.state === 'escalated_expired_terminal').length
  const driftScore = total > 0 ? Number(((escalations + denies) / total).toFixed(2)) : 0

  return c.json({
    agentId,
    riskTier,
    status,
    driftScore,
    recentRequests,
  })
})




// ====================
// ENTITIES RAIL ENDPOINTS (WF5-API-04.3 unlocked)
// ====================

app.get('/entities', async (c) => {
  type LinkRow = { entity_id: string; interface_count: number; rep_count: number }

  const entities = await c.env.DB.prepare(
    `SELECT entity_id, entity_type, display_name, legal_name, owner_principal_id, status, trust_state, exposure_score, created_at, updated_at FROM entities ORDER BY updated_at DESC`
  ).all<EntityRow>()

  const links = await c.env.DB.prepare(
    `SELECT e.entity_id as entity_id,
            COUNT(DISTINCT i.interface_id) as interface_count,
            COUNT(DISTINCT r.representation_id) as rep_count
       FROM entities e
       LEFT JOIN entity_interfaces i ON i.entity_id = e.entity_id
       LEFT JOIN agent_entity_representations r ON r.entity_id = e.entity_id AND r.revoked_at IS NULL
      GROUP BY e.entity_id`
  ).all<LinkRow>()

  const index = new Map<string, LinkRow>()
  for (const row of (links.results ?? [])) index.set(String(row.entity_id), row)

  const out = (entities.results ?? []).map((row) => {
    const extra = index.get(String(row.entity_id))
    return {
      entityId: row.entity_id,
      entityType: normalizeEntityType(row.entity_type),
      name: row.display_name,
      trustState: normalizeEntityTrustState(row.trust_state),
      exposureScore: Number(row.exposure_score ?? 0),
      status: normalizeEntityStatus(row.status),
      interfaceCount: Number(extra?.interface_count ?? 0),
      representationCount: Number(extra?.rep_count ?? 0),
      updatedAt: Number(row.updated_at ?? 0),
    }
  })

  return c.json({ entities: out })
})

app.get('/entities/:entityId', async (c) => {
  const entityId = c.req.param('entityId')

  const entity = await c.env.DB.prepare(
    `SELECT entity_id, entity_type, display_name, legal_name, owner_principal_id, status, trust_state, exposure_score, created_at, updated_at FROM entities WHERE entity_id = ?`
  ).bind(entityId).first<EntityRow>()

  if (!entity) {
    return c.json(toStructuredError('hitl_request_not_found', 'Entity not found'), statusForReasonCode('hitl_request_not_found'))
  }

  type InterfaceRow = {
    interface_id: string
    kind: string
    label: string
    locator: string
    verification_state: string
    auth_mode?: string | null
    created_at: number
    updated_at: number
  }
  const interfaces = await c.env.DB.prepare(
    `SELECT interface_id, kind, label, locator, verification_state, auth_mode, created_at, updated_at FROM entity_interfaces WHERE entity_id = ? ORDER BY updated_at DESC`
  ).bind(entityId).all<InterfaceRow>()

  type RepRow = {
    representation_id: string
    agent_id: string
    principal_id: string
    scopes_json: string
    interface_ids_json?: string | null
    issued_at: number
    expires_at?: number | null
    revoked_at?: number | null
  }
  const reps = await c.env.DB.prepare(
    `SELECT representation_id, agent_id, principal_id, scopes_json, interface_ids_json, issued_at, expires_at, revoked_at
       FROM agent_entity_representations
      WHERE entity_id = ?
      ORDER BY issued_at DESC`
  ).bind(entityId).all<RepRow>()

  const parsedInterfaces = (interfaces.results ?? []).map((r) => ({
    interfaceId: r.interface_id,
    kind: normalizeEntityType(r.kind),
    label: r.label,
    locator: r.locator,
    verificationState: normalizeEntityType(r.verification_state),
    authMode: r.auth_mode ?? undefined,
    createdAt: Number(r.created_at ?? 0),
    updatedAt: Number(r.updated_at ?? 0),
  }))

  const parsedReps = (reps.results ?? []).map((r) => {
    let scopes: string[] = []
    let interfaceIds: string[] | undefined
    try {
      const parsed = JSON.parse(r.scopes_json)
      if (Array.isArray(parsed)) scopes = parsed.map((v) => String(v))
    } catch {}
    try {
      if (r.interface_ids_json) {
        const parsed = JSON.parse(r.interface_ids_json)
        if (Array.isArray(parsed)) interfaceIds = parsed.map((v) => String(v))
      }
    } catch {}

    return {
      representationId: r.representation_id,
      agentId: r.agent_id,
      principalId: r.principal_id,
      scopes,
      interfaceIds,
      issuedAt: Number(r.issued_at ?? 0),
      expiresAt: r.expires_at ?? undefined,
      revokedAt: r.revoked_at ?? undefined,
    }
  })

  return c.json({
    entityId: entity.entity_id,
    entityType: normalizeEntityType(entity.entity_type),
    displayName: entity.display_name,
    legalName: entity.legal_name ?? undefined,
    ownerPrincipalId: entity.owner_principal_id,
    status: normalizeEntityStatus(entity.status),
    trustState: normalizeEntityTrustState(entity.trust_state),
    exposureScore: Number(entity.exposure_score ?? 0),
    createdAt: Number(entity.created_at ?? 0),
    updatedAt: Number(entity.updated_at ?? 0),
    interfaces: parsedInterfaces,
    representations: parsedReps,
  })
})


// ====================
// POLICY RAIL ENDPOINTS (WF5-API-03)
// ====================

app.get('/policy/config', async (c) => {
  const scopeQuery = c.req.query('scope')
  const scope: PolicyScope = isPolicyScope(scopeQuery) ? scopeQuery : 'global'
  const scopeIdInput = c.req.query('scopeId')
  const scopeId = normalizeScopeId(scope, scopeIdInput)

  if (scope === 'agent' && !scopeId) {
    return c.json(toStructuredError('trust_context_missing_binding', 'scopeId is required for agent scope'), statusForReasonCode('trust_context_missing_binding'))
  }

  type Row = { scope: PolicyScope; scope_id: string; version_id: string; rules_json: string }
  const row = await c.env.DB.prepare(
    `SELECT scope, scope_id, version_id, rules_json FROM policy_active_configs WHERE scope = ? AND scope_id = ?`
  ).bind(scope, scopeId).first<Row>()

  if (!row) {
    return c.json({
      scope,
      ...(scope === 'agent' ? { scopeId } : {}),
      rules: [],
    })
  }

  let rules: PolicyRule[] = []
  try {
    const parsed = JSON.parse(row.rules_json)
    if (Array.isArray(parsed)) {
      rules = parsed.filter(isPolicyRule)
    }
  } catch {
    rules = []
  }

  return c.json({
    scope: row.scope,
    ...(row.scope === 'agent' ? { scopeId: row.scope_id } : {}),
    rules,
    policyVersion: row.version_id,
  })
})

app.post('/policy/simulate', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'Invalid JSON body'), statusForReasonCode('trust_context_invalid_request_shape'))
  }

  const parsed = parsePolicyConfigBody(body)
  if (!parsed.ok) {
    return c.json(toStructuredError(parsed.reasonCode, parsed.message), statusForReasonCode(parsed.reasonCode))
  }

  const policy = toPolicyShapeFromRules(parsed.rules)
  const simulated = simulatePolicy({
    policy,
    request: {
      amount: 50,
      category: 'ops',
      hour: 12,
    }
  })

  const affectedAgents = parsed.scope === 'global' ? 25 : 1
  const highRiskAgents = simulated.decision === 'allow' ? 0 : Math.min(affectedAgents, parsed.scope === 'global' ? 5 : 1)
  const after = simulated.decision === 'allow' ? 'allow' : simulated.decision === 'deny' ? 'deny' : 'escalate'

  return c.json({
    status: 'ok',
    blastRadius: {
      affectedAgents,
      highRiskAgents,
    },
    predictedChanges: [
      {
        requestClass: 'payment',
        before: 'allow',
        after,
      }
    ],
    decision: simulated.decision,
    tier: simulated.tier,
    reasons: simulated.reasons,
  })
})

app.post('/policy/apply', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'Invalid JSON body'), statusForReasonCode('trust_context_invalid_request_shape'))
  }

  const parsed = parsePolicyConfigBody(body)
  if (!parsed.ok) {
    return c.json(toStructuredError(parsed.reasonCode, parsed.message), statusForReasonCode(parsed.reasonCode))
  }

  const principalForDraft = parsed.scope === 'agent' ? (parsed.scopeIdDisplay ?? parsed.scopeIdNormalized) : 'global'
  const draft = createPolicyDraft({
    principalId: principalForDraft,
    policy: toPolicyShapeFromRules(parsed.rules),
  })
  const published = publishPolicy({ draftId: draft.id })

  const canonicalRules = stableStringify(parsed.rules)
  const versionId = `${draft.version}_${fnv1aHash(`${parsed.scope}:${parsed.scopeIdNormalized}:${canonicalRules}`)}`
  const now = Date.now()
  const eventId = `pa_${versionId}_${now}`

  await c.env.DB.prepare(`
    INSERT INTO policy_active_configs (scope, scope_id, version_id, rules_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(scope, scope_id) DO UPDATE SET
      version_id = excluded.version_id,
      rules_json = excluded.rules_json,
      updated_at = excluded.updated_at
  `).bind(
    parsed.scope,
    parsed.scopeIdNormalized,
    versionId,
    JSON.stringify(parsed.rules),
    now,
  ).run()

  await c.env.DB.prepare(`
    INSERT INTO policy_versions (version_id, scope, scope_id, rules_json, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(version_id) DO NOTHING
  `).bind(
    versionId,
    parsed.scope,
    parsed.scopeIdNormalized,
    JSON.stringify(parsed.rules),
    now,
  ).run()

  await c.env.DB.prepare(`
    INSERT INTO policy_audit_events (event_id, scope, scope_id, version_id, event_type, event_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    eventId,
    parsed.scope,
    parsed.scopeIdNormalized,
    versionId,
    'policy_apply',
    JSON.stringify({
      status: published.status,
      draftId: draft.id,
      policyVersion: versionId,
      scope: parsed.scope,
      scopeId: parsed.scopeIdDisplay,
      ruleCount: parsed.rules.length,
      timestamp: now,
    }),
    now,
  ).run()

  return c.json({
    status: 'ok',
    policyVersion: versionId,
    auditEventId: eventId,
    message: 'Policy applied',
  })
})


// ====================
// METRICS ENDPOINTS (WF5 H8)
// ====================

function parseWindow(window: string | undefined): number {
  switch (window) {
    case '24h': return 24 * 60 * 60 * 1000
    case '7d': return 7 * 24 * 60 * 60 * 1000
    case '30d': return 30 * 24 * 60 * 60 * 1000
    default: return 24 * 60 * 60 * 1000
  }
}

app.get('/metrics/summary', async (c) => {
  const now = Date.now()
  const windowMs = parseWindow(c.req.query('window'))
  const startMs = now - windowMs

  const store = new D1RequestWorkflowStore(c.env.DB)
  const events = await store.getMetricsEventsInWindow(startMs, now)
  const summary = computeMetricsSummary(events as any)

  return c.json({
    window: c.req.query('window') || '24h',
    schema_version: METRICS_SCHEMA_VERSION,
    projector_version: METRICS_PROJECTOR_VERSION,
    ...summary,
  })
})

app.get('/metrics/series', async (c) => {
  const metric = c.req.query('metric') || 'UAIR'
  const bucket = (c.req.query('bucket') === 'day' ? 'day' : 'hour') as 'hour' | 'day'
  const now = Date.now()
  const startMs = now - parseWindow(c.req.query('window'))

  const metricMap: Record<string, string> = {
    UAIR: 'uair',
    AIRT: 'airt_p95_ms',
    GAR: 'gar',
    TCA: 'tca',
  }

  const metricName = metricMap[String(metric).toUpperCase()] || 'uair'

  const store = new D1RequestWorkflowStore(c.env.DB)
  const rows = await store.getMetricsRollups(metricName, bucket, startMs, now)

  return c.json({
    metric: String(metric).toUpperCase(),
    bucket,
    schema_version: METRICS_SCHEMA_VERSION,
    projector_version: METRICS_PROJECTOR_VERSION,
    points: rows,
  })
})

app.get('/metrics/reasons', async (c) => {
  const now = Date.now()
  const startMs = now - parseWindow(c.req.query('window'))

  const store = new D1RequestWorkflowStore(c.env.DB)
  const events = await store.getMetricsEventsInWindow(startMs, now)

  const counts: Record<string, number> = {}
  for (const e of events as any[]) {
    const k = String(e.reasonFamily || 'unknown')
    counts[k] = (counts[k] || 0) + 1
  }

  return c.json({
    window: c.req.query('window') || '24h',
    schema_version: METRICS_SCHEMA_VERSION,
    reason_families: counts,
  })
})



app.post('/metrics/project', async (c) => {
  const now = Date.now()
  const windowMs = parseWindow(c.req.query('window'))
  const startMs = now - windowMs

  const store = new D1RequestWorkflowStore(c.env.DB)
  const events = await store.getMetricsEventsInWindow(startMs, now)
  const summary = computeMetricsSummary(events as any)

  const hourBucket = Math.floor(now / (60 * 60 * 1000)) * 60 * 60 * 1000
  const dayBucket = Math.floor(now / (24 * 60 * 60 * 1000)) * 24 * 60 * 60 * 1000

  const rows = [
    { metricName: 'uair', valueReal: summary.uair },
    { metricName: 'airt_p50_ms', valueReal: summary.airtP50Ms },
    { metricName: 'airt_p95_ms', valueReal: summary.airtP95Ms },
    { metricName: 'gar', valueReal: summary.gar },
    { metricName: 'tca', valueReal: summary.tca },
  ]

  for (const r of rows) {
    await store.upsertMetricsRollupHourly({
      bucketStartMs: hourBucket,
      metricName: r.metricName,
      dimensionKey: 'all',
      valueReal: r.valueReal,
      sampleCount: events.length,
      schemaVersion: METRICS_SCHEMA_VERSION,
      projectorVersion: METRICS_PROJECTOR_VERSION,
    })

    await store.upsertMetricsRollupDaily({
      bucketStartMs: dayBucket,
      metricName: r.metricName,
      dimensionKey: 'all',
      valueReal: r.valueReal,
      sampleCount: events.length,
      schemaVersion: METRICS_SCHEMA_VERSION,
      projectorVersion: METRICS_PROJECTOR_VERSION,
    })
  }

  return c.json({
    status: 'ok',
    projected_events: events.length,
    hour_bucket: hourBucket,
    day_bucket: dayBucket,
    metrics: summary,
  })
})

// ====================
// OAUTH HELPERS
// ====================

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function buildOAuthUrl(provider: string, state: string, codeChallenge: string, env: Bindings): string {
  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${env.ENVIRONMENT === 'production' ? 'https://handshake.dev' : 'http://localhost:8787'}/callback`,
      response_type: 'code',
      scope: 'openid profile email',
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
      redirect_uri: `${env.ENVIRONMENT === 'production' ? 'https://handshake.dev' : 'http://localhost:8787'}/callback`,
      scope: 'read:user user:email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  throw new Error('Invalid provider');
}

async function exchangeCodeForToken(provider: string, code: string, codeVerifier: string, env: Bindings): Promise<any> {
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
        redirect_uri: `${env.ENVIRONMENT === 'production' ? 'https://handshake.dev' : 'http://localhost:8787'}/callback`
      })
    });

    return response.json();
  }

  if (provider === 'github') {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        code_verifier: codeVerifier
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
    return response.json();
  }

  if (provider === 'github') {
    const response = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data: any = await response.json();
    return {
      id: String(data.id),
      name: data.login,
      email: data.email
    };
  }

  throw new Error('Invalid provider');
}

function getOwnerDisplay(linkage: any): string {
  if (linkage.privacy_level === 'anonymous') return 'Anonymous Verified';
  if (linkage.privacy_level === 'pseudonymous') return linkage.owner_pseudonym || 'Verified User';
  return linkage.owner_display_name || 'Verified User';
}

function computeVerificationLevel(linkage: any): string {
  if (linkage.reputation_score >= 80) return 'high';
  if (linkage.reputation_score >= 50) return 'medium';
  return 'basic';
}

function computeBadge(linkage: any): string {
  const level = computeVerificationLevel(linkage);
  if (level === 'high') return '🤝 verified (trusted)';
  if (level === 'medium') return '🤝 verified (established)';
  return '🤝 verified';
}

export default app;
