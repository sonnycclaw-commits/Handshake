export type HITLQueueQuery = {
  principalId: string
  items?: HITLQueueItem[]
}

export type HITLQueueItem = {
  requestId: string
  principalId: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  tier?: number
  action?: string
  createdAt?: number
  expiresAt?: number
}

export type HITLQueueResult = {
  items: HITLQueueItem[]
}

export type HITLDecisionHistoryQuery = {
  requestId: string
  events?: HITLDecisionEvent[]
}

export type HITLDecisionEvent = {
  requestId: string
  decision: 'approved' | 'rejected' | 'expired'
  actorId?: string
  timestamp?: number
  reason?: string
}

export type HITLDecisionHistoryResult = {
  events: HITLDecisionEvent[]
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function toTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return 0
}

export function listHITLQueue(query: HITLQueueQuery): HITLQueueResult {
  if (!query || typeof query !== 'object') {
    throw new Error('invalid_input: object required')
  }

  if (!isNonEmptyString(query.principalId)) {
    throw new Error('invalid_input: principalId is required')
  }

  const pool = Array.isArray(query.items) ? query.items : []

  const items = pool
    .filter((item) => item.principalId === query.principalId.trim() && item.status === 'pending')
    .sort((a, b) => toTimestamp(a.expiresAt) - toTimestamp(b.expiresAt))

  return { items }
}

export function getHITLDecisionHistory(query: HITLDecisionHistoryQuery): HITLDecisionHistoryResult {
  if (!query || typeof query !== 'object') {
    throw new Error('invalid_input: object required')
  }

  if (!isNonEmptyString(query.requestId)) {
    throw new Error('invalid_input: requestId is required')
  }

  const pool = Array.isArray(query.events) ? query.events : []

  const events = pool
    .filter((event) => event.requestId === query.requestId.trim())
    .sort((a, b) => toTimestamp(a.timestamp) - toTimestamp(b.timestamp))

  return { events }
}
