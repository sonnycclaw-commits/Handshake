import { forbidden, invalidInput, notFound } from '../errors/governance-errors'

type QuorumDecision = 'approve' | 'reject'
type QuorumStatus = 'pending' | 'approved' | 'rejected'

type CreateQuorumRequestInput = {
  required: number
  approvers: string[]
}

type SubmitQuorumDecisionInput = {
  requestId: string
  approverId: string
  decision: QuorumDecision
}

type QuorumRuntime = {
  now?: () => number
  nextId?: (required: number, approvers: string[]) => string
}

export type QuorumRequest = {
  id: string
  required: number
  approvers: string[]
  approvals: string[]
  rejections: string[]
  status: QuorumStatus
  createdAt: number
  decidedAt?: number
}

export interface QuorumStore {
  get(requestId: string): QuorumRequest | undefined
  set(request: QuorumRequest): void
}

class InMemoryQuorumStore implements QuorumStore {
  private readonly map = new Map<string, QuorumRequest>()

  get(requestId: string): QuorumRequest | undefined {
    return this.map.get(requestId)
  }

  set(request: QuorumRequest): void {
    this.map.set(request.id, request)
  }
}

const defaultStore: QuorumStore = new InMemoryQuorumStore()
let activeStore: QuorumStore = defaultStore

export function setQuorumStore(store: QuorumStore): void {
  activeStore = store
}

export function resetQuorumStore(): void {
  activeStore = defaultStore
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function cloneRequest(req: QuorumRequest): QuorumRequest {
  return {
    ...req,
    approvers: [...req.approvers],
    approvals: [...req.approvals],
    rejections: [...req.rejections]
  }
}

function defaultBuildId(required: number, approvers: string[], now: number): string {
  const base = `${required}:${approvers.join(',')}:${now}:${Math.random().toString(36).slice(2, 8)}`
  let hash = 0x811c9dc5
  for (let i = 0; i < base.length; i += 1) {
    hash ^= base.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `q_${(hash >>> 0).toString(16)}`
}

export function getQuorumRequestById(requestId: string): QuorumRequest | undefined {
  if (!isNonEmptyString(requestId)) return undefined
  const req = activeStore.get(requestId.trim())
  return req ? cloneRequest(req) : undefined
}

export function upsertQuorumRequest(request: QuorumRequest): void {
  activeStore.set(cloneRequest(request))
}

export function createQuorumRequest(input: CreateQuorumRequestInput, runtime: QuorumRuntime = {}): QuorumRequest {
  if (!input || typeof input !== 'object') throw invalidInput('object required')
  if (!Number.isInteger(input.required) || input.required <= 0) {
    throw invalidInput('required must be positive integer', { field: 'required' })
  }
  if (!Array.isArray(input.approvers) || input.approvers.length === 0) {
    throw invalidInput('approvers required', { field: 'approvers' })
  }

  const approvers = Array.from(new Set(input.approvers.map((a) => (isNonEmptyString(a) ? a.trim() : '')).filter(Boolean)))
  if (approvers.length === 0) throw invalidInput('valid approvers required', { field: 'approvers' })
  if (input.required > approvers.length) {
    throw invalidInput('required cannot exceed approvers length', {
      required: input.required,
      approverCount: approvers.length
    })
  }

  const now = runtime.now ?? Date.now
  const nextId = runtime.nextId ?? ((required: number, approved: string[]) => defaultBuildId(required, approved, now()))
  const createdAt = now()

  const req: QuorumRequest = {
    id: nextId(input.required, approvers),
    required: input.required,
    approvers,
    approvals: [],
    rejections: [],
    status: 'pending',
    createdAt
  }

  activeStore.set(req)
  return cloneRequest(req)
}

export function submitQuorumDecision(input: SubmitQuorumDecisionInput, runtime: QuorumRuntime = {}): QuorumRequest {
  if (!input || typeof input !== 'object') throw invalidInput('object required')
  if (!isNonEmptyString(input.requestId)) throw invalidInput('requestId is required', { field: 'requestId' })
  if (!isNonEmptyString(input.approverId)) throw invalidInput('approverId is required', { field: 'approverId' })
  if (input.decision !== 'approve' && input.decision !== 'reject') {
    throw invalidInput('decision must be approve|reject', { field: 'decision' })
  }

  const req = activeStore.get(input.requestId.trim())
  if (!req) throw notFound('quorum request not found', { requestId: input.requestId })
  if (req.status !== 'pending') return cloneRequest(req)

  const approverId = input.approverId.trim()
  if (!req.approvers.includes(approverId)) {
    throw forbidden('approver not authorized', { approverId, requestId: req.id })
  }
  if (req.approvals.includes(approverId) || req.rejections.includes(approverId)) return cloneRequest(req)

  if (input.decision === 'approve') req.approvals.push(approverId)
  else req.rejections.push(approverId)

  const now = runtime.now ?? Date.now

  if (req.approvals.length >= req.required) {
    req.status = 'approved'
    req.decidedAt = now()
  } else {
    const remainingApprovers = req.approvers.length - req.approvals.length - req.rejections.length
    const maxPossibleApprovals = req.approvals.length + remainingApprovers
    if (maxPossibleApprovals < req.required) {
      req.status = 'rejected'
      req.decidedAt = now()
    }
  }

  activeStore.set(req)
  return cloneRequest(req)
}
