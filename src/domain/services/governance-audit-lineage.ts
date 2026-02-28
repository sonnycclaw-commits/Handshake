import { invalidInput } from '../errors/governance-errors'

type BuildGovernanceAuditLineageInput = {
  decisionId: string
  previousHash?: string
  actorId?: string
  action?: string
  reason?: string
}

export type GovernanceLineageNode = {
  decisionId: string
  timestamp: number
  previousHash: string
  hash: string
  actorId?: string
  action?: string
  reason?: string
}

export type GovernanceAuditLineage = {
  chain: ReadonlyArray<GovernanceLineageNode>
}

export interface GovernanceLineageStore {
  append(node: GovernanceLineageNode): void
  listByDecisionId(decisionId: string): GovernanceLineageNode[]
}

class InMemoryGovernanceLineageStore implements GovernanceLineageStore {
  private readonly rows: GovernanceLineageNode[] = []

  append(node: GovernanceLineageNode): void {
    this.rows.push(node)
  }

  listByDecisionId(decisionId: string): GovernanceLineageNode[] {
    return this.rows.filter((r) => r.decisionId === decisionId)
  }
}

const defaultStore: GovernanceLineageStore = new InMemoryGovernanceLineageStore()
let activeStore: GovernanceLineageStore = defaultStore

export function setGovernanceLineageStore(store: GovernanceLineageStore): void {
  activeStore = store
}

export function resetGovernanceLineageStore(): void {
  activeStore = defaultStore
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function freezeNode(node: GovernanceLineageNode): GovernanceLineageNode {
  return Object.freeze({ ...node })
}

export function getGovernanceLineageByDecisionId(decisionId: string): ReadonlyArray<GovernanceLineageNode> {
  if (!isNonEmptyString(decisionId)) return Object.freeze([])
  const chain = activeStore
    .listByDecisionId(decisionId.trim())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(freezeNode)
  return Object.freeze(chain)
}

export function buildGovernanceAuditLineage(input: BuildGovernanceAuditLineageInput): GovernanceAuditLineage {
  if (!input || typeof input !== 'object') throw invalidInput('object required')
  if (!isNonEmptyString(input.decisionId)) throw invalidInput('decisionId is required', { field: 'decisionId' })

  const decisionId = input.decisionId.trim()
  const timestamp = Date.now()

  const existing = getGovernanceLineageByDecisionId(decisionId)
  const previousHash =
    isNonEmptyString(input.previousHash)
      ? input.previousHash.trim()
      : existing.length > 0
        ? existing[existing.length - 1].hash
        : 'root'

  const payload = [decisionId, previousHash, String(timestamp), input.actorId ?? '', input.action ?? '', input.reason ?? ''].join('|')

  const node = freezeNode({
    decisionId,
    timestamp,
    previousHash,
    hash: fnv1a(payload),
    ...(isNonEmptyString(input.actorId) ? { actorId: input.actorId.trim() } : {}),
    ...(isNonEmptyString(input.action) ? { action: input.action.trim() } : {}),
    ...(isNonEmptyString(input.reason) ? { reason: input.reason.trim() } : {})
  })

  activeStore.append(node)

  return {
    chain: getGovernanceLineageByDecisionId(decisionId)
  }
}
