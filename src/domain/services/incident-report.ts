type IncidentInput = {
  incidentId: string
  timeline?: Array<Record<string, unknown>>
  affectedActors?: string[]
  summary?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
}

export type IncidentReport = {
  incidentId: string
  summary: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timeline: Array<Record<string, unknown>>
  affectedActors: string[]
  generatedAt: number
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function toTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return 0
}

export function generateIncidentReport(input: IncidentInput): IncidentReport {
  if (!input || typeof input !== 'object') {
    throw new Error('invalid_input: object required')
  }

  if (!isNonEmptyString(input.incidentId)) {
    throw new Error('invalid_input: incidentId is required')
  }

  const timeline = (Array.isArray(input.timeline) ? input.timeline : []).slice().sort((a, b) => toTimestamp(a.timestamp) - toTimestamp(b.timestamp))
  const affectedActors = Array.isArray(input.affectedActors)
    ? Array.from(new Set(input.affectedActors.filter((a): a is string => isNonEmptyString(a)).map((a) => a.trim())))
    : []

  return {
    incidentId: input.incidentId.trim(),
    summary: isNonEmptyString(input.summary) ? input.summary.trim() : 'Incident report generated',
    severity: input.severity ?? 'medium',
    timeline,
    affectedActors,
    generatedAt: Date.now()
  }
}
