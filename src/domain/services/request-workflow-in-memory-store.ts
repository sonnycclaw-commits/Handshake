import type { RequestWorkflowStore, StoredRequestRecord } from '../../ports/request-workflow-store'

export class DefaultInMemoryRequestWorkflowStore implements RequestWorkflowStore {
  private readonly requests = new Map<string, StoredRequestRecord>()
  private readonly audits = new Map<string, Array<Record<string, unknown>>>()
  private readonly lineage = new Map<string, Array<Record<string, unknown>>>()
  private readonly escalations = new Map<string, number[]>()
  private readonly metricsEvents = new Array<Record<string, unknown>>()
  private readonly hourly = new Map<string, Record<string, unknown>>()
  private readonly daily = new Map<string, Record<string, unknown>>()

  async getRequest(requestId: string): Promise<StoredRequestRecord | null> {
    return this.requests.get(requestId) ?? null
  }

  async saveRequest(record: StoredRequestRecord): Promise<void> {
    this.requests.set(record.requestId, record)
  }

  async appendAudit(requestId: string, event: Record<string, unknown>): Promise<void> {
    const current = this.audits.get(requestId) ?? []
    current.push(event)
    this.audits.set(requestId, current)
  }

  async getAudit(requestId: string): Promise<Array<Record<string, unknown>>> {
    return [...(this.audits.get(requestId) ?? [])]
  }

  async appendLineage(requestId: string, event: Record<string, unknown>): Promise<void> {
    const current = this.lineage.get(requestId) ?? []
    current.push(event)
    this.lineage.set(requestId, current)
  }

  async getLineage(requestId: string): Promise<Array<Record<string, unknown>>> {
    return [...(this.lineage.get(requestId) ?? [])]
  }

  async appendMetricsEvent(event: {
    eventId: string
    requestId: string
    timestampMs: number
    decision: string
    reasonCode: string
    reasonFamily: string
    riskTier: string
    isTerminal: boolean
    hasValidLineage: boolean
    incidentDetectedTsMs?: number
    terminalDecisionTsMs?: number
    humanMinutes?: number
    computeCostUnits?: number
    escalationOverheadUnits?: number
    schemaVersion: string
    projectorVersion: string
  }): Promise<void> {
    if (this.metricsEvents.find((e) => e.eventId === event.eventId)) return
    this.metricsEvents.push({ ...event })
  }

  async getMetricsEventsInWindow(startMs: number, endMs: number): Promise<Array<Record<string, unknown>>> {
    return this.metricsEvents
      .filter((e: any) => e.timestampMs >= startMs && e.timestampMs < endMs)
      .sort((a: any, b: any) => a.timestampMs - b.timestampMs)
  }

  async upsertMetricsRollupHourly(row: {
    bucketStartMs: number
    metricName: string
    dimensionKey: string
    valueReal: number
    sampleCount: number
    schemaVersion: string
    projectorVersion: string
  }): Promise<void> {
    const key = `${row.bucketStartMs}:${row.metricName}:${row.dimensionKey}`
    this.hourly.set(key, { ...row })
  }

  async upsertMetricsRollupDaily(row: {
    bucketStartMs: number
    metricName: string
    dimensionKey: string
    valueReal: number
    sampleCount: number
    schemaVersion: string
    projectorVersion: string
  }): Promise<void> {
    const key = `${row.bucketStartMs}:${row.metricName}:${row.dimensionKey}`
    this.daily.set(key, { ...row })
  }

  async getMetricsRollups(metricName: string, bucket: 'hour' | 'day', startMs: number, endMs: number): Promise<Array<Record<string, unknown>>> {
    const source = bucket === 'hour' ? this.hourly : this.daily
    return Array.from(source.values())
      .filter((r: any) => r.metricName === metricName && r.bucketStartMs >= startMs && r.bucketStartMs < endMs)
      .sort((a: any, b: any) => a.bucketStartMs - b.bucketStartMs)
  }

  async getEscalationHistory(key: string): Promise<number[]> {
    return [...(this.escalations.get(key) ?? [])]
  }

  async setEscalationHistory(key: string, timestamps: number[]): Promise<void> {
    this.escalations.set(key, [...timestamps])
  }
}
