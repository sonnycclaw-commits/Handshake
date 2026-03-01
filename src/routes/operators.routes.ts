import { Hono } from 'hono'
import type { AppEnv } from '../core/types'
import {
  configureWorkflowStores,
  mapTierToRiskTier,
  maxNumericTimestamp,
  statusForReasonCode,
  toStructuredError,
} from '../core/workflow'
import {
  normalizeEntityType,
  normalizeEntityStatus,
  normalizeEntityTrustState,
  type EntityRow,
} from '../core/entities'

export const operatorRoutes = new Hono<AppEnv>()

// Agents rail
operatorRoutes.get('/agents', async (c) => {
  configureWorkflowStores(c.env)

  type LinkageRow = { agent_id: string; revoked_at?: string | null }
  const linkages = await c.env.DB.prepare(`SELECT agent_id, revoked_at FROM linkages`).all<LinkageRow>()

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
          result: JSON.parse(r.result_json) as { tier?: number; timestamp?: number },
        }
      } catch {
        return {
          state: r.state,
          requestTimestamp: r.request_timestamp,
          result: {},
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

operatorRoutes.get('/agents/:agentId', async (c) => {
  configureWorkflowStores(c.env)
  const agentId = c.req.param('agentId')

  type LinkageRow = { agent_id: string; revoked_at?: string | null }
  const linkage = await c.env.DB.prepare(`SELECT agent_id, revoked_at FROM linkages WHERE agent_id = ?`).bind(agentId).first<LinkageRow>()

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

// Entities rail
operatorRoutes.get('/entities', async (c) => {
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

operatorRoutes.get('/entities/:entityId', async (c) => {
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
