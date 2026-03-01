import { Hono } from 'hono'
import type { AppEnv } from '../core/types'
import { D1RequestWorkflowStore } from '../adapters/persistence/d1-request-workflow-store'
import { computeMetricsSummary, METRICS_PROJECTOR_VERSION, METRICS_SCHEMA_VERSION } from '../domain/services/wf5-metrics-projector'

export const metricsRoutes = new Hono<AppEnv>()

function parseWindow(window: string | undefined): number {
  switch (window) {
    case '24h': return 24 * 60 * 60 * 1000
    case '7d': return 7 * 24 * 60 * 60 * 1000
    case '30d': return 30 * 24 * 60 * 60 * 1000
    default: return 24 * 60 * 60 * 1000
  }
}

metricsRoutes.get('/metrics/summary', async (c) => {
  const now = Date.now()
  const windowMs = parseWindow(c.req.query('window'))
  const startMs = now - windowMs

  const store = new D1RequestWorkflowStore(c.env.DB)
  const events = await store.getMetricsEventsInWindow(startMs, now)
  const summary = computeMetricsSummary(events as any)

  return c.json({
    window: c.req.query('window') || '24h',
    schemaVersion: METRICS_SCHEMA_VERSION,
    projectorVersion: METRICS_PROJECTOR_VERSION,
    ...summary,
  })
})

metricsRoutes.get('/metrics/series', async (c) => {
  const metric = c.req.query('metric') || 'escalation_rate'
  const bucket = c.req.query('bucket') === 'day' ? 'day' : 'hour'
  const now = Date.now()
  const windowMs = parseWindow(c.req.query('window'))
  const startMs = now - windowMs

  const store = new D1RequestWorkflowStore(c.env.DB)
  const rollups = await store.getMetricsRollups(metric, bucket, startMs, now)

  const series = rollups.map((r: any) => ({
    timestamp: r.bucketStartMs,
    value: r.valueReal,
    sampleCount: r.sampleCount,
    dimension: r.dimensionKey,
  }))

  return c.json({
    metric,
    bucket,
    window: c.req.query('window') || '24h',
    schemaVersion: METRICS_SCHEMA_VERSION,
    projectorVersion: METRICS_PROJECTOR_VERSION,
    series,
  })
})

metricsRoutes.get('/metrics/reasons', async (c) => {
  const now = Date.now()
  const windowMs = parseWindow(c.req.query('window'))
  const startMs = now - windowMs

  const store = new D1RequestWorkflowStore(c.env.DB)
  const events = await store.getMetricsEventsInWindow(startMs, now)

  const counts = new Map<string, number>()
  for (const event of events as any[]) {
    const family = event.reasonFamily || 'unknown'
    counts.set(family, (counts.get(family) || 0) + 1)
  }

  const total = Array.from(counts.values()).reduce((acc, n) => acc + n, 0)
  const families = Array.from(counts.entries())
    .map(([reasonFamily, count]) => ({
      reasonFamily,
      count,
      percentage: total > 0 ? count / total : 0,
    }))
    .sort((a, b) => b.count - a.count)

  return c.json({
    window: c.req.query('window') || '24h',
    schemaVersion: METRICS_SCHEMA_VERSION,
    projectorVersion: METRICS_PROJECTOR_VERSION,
    total,
    families,
  })
})

metricsRoutes.post('/metrics/project', async (c) => {
  const body = await c.req.json() as {
    eventId?: string
    requestId?: string
    timestampMs?: number
    decision?: string
    reasonCode?: string
    reasonFamily?: string
    riskTier?: string
    isTerminal?: boolean
    hasValidLineage?: boolean
    incidentDetectedTsMs?: number
    terminalDecisionTsMs?: number
    humanMinutes?: number
    computeCostUnits?: number
    escalationOverheadUnits?: number
  }

  if (!body?.eventId || !body?.requestId || !body?.timestampMs || !body?.decision || !body?.reasonCode || !body?.reasonFamily || !body?.riskTier) {
    return c.json({
      status: 'error',
      error: 'invalid_metrics_event',
      message: 'Missing required fields: eventId, requestId, timestampMs, decision, reasonCode, reasonFamily, riskTier',
    }, 400)
  }

  const store = new D1RequestWorkflowStore(c.env.DB)
  await store.appendMetricsEvent({
    eventId: body.eventId,
    requestId: body.requestId,
    timestampMs: body.timestampMs,
    decision: body.decision,
    reasonCode: body.reasonCode,
    reasonFamily: body.reasonFamily,
    riskTier: body.riskTier,
    isTerminal: body.isTerminal ?? true,
    hasValidLineage: body.hasValidLineage ?? true,
    incidentDetectedTsMs: body.incidentDetectedTsMs,
    terminalDecisionTsMs: body.terminalDecisionTsMs,
    humanMinutes: body.humanMinutes,
    computeCostUnits: body.computeCostUnits,
    escalationOverheadUnits: body.escalationOverheadUnits,
    schemaVersion: METRICS_SCHEMA_VERSION,
    projectorVersion: METRICS_PROJECTOR_VERSION,
  })

  return c.json({
    status: 'ok',
    schemaVersion: METRICS_SCHEMA_VERSION,
    projectorVersion: METRICS_PROJECTOR_VERSION,
  })
})
