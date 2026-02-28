import type { HITLStore, HITLStoredRequest } from '../../ports/hitl-store'

type HITLInput = {
  agentId: string
  principalId: string
  tier: number
  action: string
}

type HITLActionMeta = {
  approverId?: string
  reason?: string
}

export type HITLRequest = {
  id: string
  agentId: string
  principalId: string
  tier: number
  action: string
  status: 'pending' | 'approved' | 'rejected'
  reason?: string
  approverId?: string
  createdAt: number
  expiresAt: number
}

const store = new Map<string, HITLRequest>()
class DefaultInMemoryHITLStore implements HITLStore {
  private readonly rows = new Map<string, HITLStoredRequest>()

  async save(request: HITLStoredRequest): Promise<void> {
    this.rows.set(request.id, { ...request })
  }

  async get(id: string): Promise<HITLStoredRequest | null> {
    const row = this.rows.get(id)
    return row ? { ...row } : null
  }
}

let hitlStore: HITLStore = new DefaultInMemoryHITLStore()

export function setHITLStore(next: HITLStore): void {
  hitlStore = next
}

function makeId(): string {
  return `hitl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function terminal(status: HITLRequest['status']): boolean {
  return status === 'approved' || status === 'rejected'
}

function toStored(req: HITLRequest): HITLStoredRequest {
  return {
    id: req.id,
    agentId: req.agentId,
    principalId: req.principalId,
    tier: req.tier,
    action: req.action,
    status: req.status,
    reason: req.reason,
    approverId: req.approverId,
    createdAt: req.createdAt,
    expiresAt: req.expiresAt,
  }
}

function fromStored(req: HITLStoredRequest): HITLRequest {
  return {
    id: req.id,
    agentId: req.agentId,
    principalId: req.principalId,
    tier: req.tier,
    action: req.action,
    status: req.status,
    reason: req.reason,
    approverId: req.approverId,
    createdAt: req.createdAt,
    expiresAt: req.expiresAt,
  }
}

export async function createHITLRequest(input: HITLInput): Promise<HITLRequest> {
  const now = Date.now()
  const req: HITLRequest = {
    id: makeId(),
    agentId: input.agentId,
    principalId: input.principalId,
    tier: input.tier,
    action: input.action,
    status: 'pending',
    createdAt: now,
    expiresAt: now + 5 * 60 * 1000
  }
  store.set(req.id, req)
  await hitlStore.save(toStored(req))
  return { ...req }
}

export async function getHITLRequest(id: string): Promise<HITLRequest | null> {
  const req = store.get(id)
  if (req) return { ...req }

  const persisted = await hitlStore.get(id)
  if (!persisted) return null
  const hydrated = fromStored(persisted)
  store.set(id, hydrated)
  return { ...hydrated }
}

export async function approveHITL(id: string, meta: HITLActionMeta): Promise<HITLRequest> {
  const current = await getHITLRequest(id)
  if (!current) throw new Error('HITL_NOT_FOUND')
  if (terminal(current.status)) return { ...current }
  if (!meta.approverId || meta.approverId !== current.principalId) throw new Error('HITL_UNAUTHORIZED_APPROVER')

  const next: HITLRequest = { ...current, status: 'approved', approverId: meta.approverId }
  store.set(id, next)
  await hitlStore.save(toStored(next))
  return { ...next }
}

export async function rejectHITL(id: string, meta: HITLActionMeta): Promise<HITLRequest> {
  const current = await getHITLRequest(id)
  if (!current) throw new Error('HITL_NOT_FOUND')
  if (terminal(current.status)) return { ...current }

  const next: HITLRequest = { ...current, status: 'rejected', reason: meta.reason ?? 'rejected' }
  store.set(id, next)
  await hitlStore.save(toStored(next))
  return { ...next }
}

/**
 * Timeout semantics:
 * - If `now` is omitted, caller is explicitly timing out this request immediately.
 * - If `now` is provided, timeout only applies when now >= expiresAt.
 */
export async function timeoutHITL(id: string, now?: number): Promise<HITLRequest> {
  const current = await getHITLRequest(id)
  if (!current) throw new Error('HITL_NOT_FOUND')
  if (terminal(current.status)) return { ...current }

  if (typeof now === 'number' && now < current.expiresAt) {
    return { ...current }
  }

  const next: HITLRequest = { ...current, status: 'rejected', reason: 'timeout_reject' }
  store.set(id, next)
  await hitlStore.save(toStored(next))
  return { ...next }
}
