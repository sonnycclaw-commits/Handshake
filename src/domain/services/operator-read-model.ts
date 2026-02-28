export interface BuildOperatorReadModelInput {
  principalId: string
  actorId?: string
  auditEntries?: Array<Record<string, unknown>>
  hitlEntries?: Array<Record<string, unknown>>
}

export interface OperatorReadModel {
  timeline: Array<Record<string, unknown>>
  filters: {
    principalId: string
    actorId?: string
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function toTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return 0
}

/**
 * Build operator-facing read model for consolidated timeline views.
 *
 * Phase 4 / P4-U1 scope:
 * - Establish service contract used by tests
 * - Carry filter state for caller scoping
 * - Return timeline container for future audit/HITL entries
 *
 * White-hat hardening:
 * - Validate caller scope inputs (fail closed)
 * - Deterministic merge + sort for timeline
 */
export function buildOperatorReadModel(input: BuildOperatorReadModelInput): OperatorReadModel {
  if (!input || typeof input !== 'object') {
    throw new Error('invalid_input: object required')
  }

  if (!isNonEmptyString(input.principalId)) {
    throw new Error('invalid_input: principalId is required')
  }

  if (input.actorId !== undefined && !isNonEmptyString(input.actorId)) {
    throw new Error('invalid_input: actorId must be non-empty when provided')
  }

  const auditEntries = Array.isArray(input.auditEntries) ? input.auditEntries : []
  const hitlEntries = Array.isArray(input.hitlEntries) ? input.hitlEntries : []

  const timeline = [...auditEntries, ...hitlEntries].sort((a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp))

  return {
    timeline,
    filters: {
      principalId: input.principalId.trim(),
      ...(input.actorId ? { actorId: input.actorId.trim() } : {})
    }
  }
}
