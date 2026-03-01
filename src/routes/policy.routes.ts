import { Hono } from 'hono'
import type { AppEnv } from '../core/types'
import {
  statusForReasonCode,
  toStructuredError,
} from '../core/workflow'
import { requireIdentityEnvelope } from '../middleware/identity-envelope'
import { requireInternalTrustContext } from '../middleware/internal-trust-context'
import {
  isPolicyScope,
  normalizeScopeId,
  type PolicyScope,
  type PolicyRule,
  parsePolicyConfigBody,
  toPolicyShapeFromRules,
  stableStringify,
  fnv1aHash,
  createPolicyDraft,
  simulatePolicy,
  publishPolicy,
} from '../core/policy'

export const policyRoutes = new Hono<AppEnv>()

policyRoutes.use('/policy/apply', requireIdentityEnvelope)
policyRoutes.use('/policy/apply', requireInternalTrustContext)

policyRoutes.get('/policy/config', async (c) => {
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
      rules = parsed.filter((x): x is PolicyRule => !!x && typeof x === 'object' && 'id' in x && 'key' in x && 'value' in x)
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

policyRoutes.post('/policy/simulate', async (c) => {
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
    },
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
      },
    ],
    decision: simulated.decision,
    tier: simulated.tier,
    reasons: simulated.reasons,
  })
})

policyRoutes.post('/policy/apply', async (c) => {
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
  const now = Date.now()
  const trust = c.get('internalTrustContext')
  const trustTag = trust?.jti ? trust.jti : 'untrusted'
  const versionId = `${draft.version}_${fnv1aHash(`${parsed.scope}:${parsed.scopeIdNormalized}:${canonicalRules}:${trustTag}`)}`
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
      internalTrustJti: trust?.jti,
      internalTrustSub: trust?.sub,
      internalTrustIss: trust?.iss,
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
