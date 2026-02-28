import type {
  RequestWorkflowStore,
  StoredRequestRecord,
} from '../../ports/request-workflow-store'

export class InMemoryRequestWorkflowStore implements RequestWorkflowStore {
  private readonly requests = new Map<string, StoredRequestRecord>()
  private readonly audits = new Map<string, Array<Record<string, unknown>>>()
  private readonly lineage = new Map<string, Array<Record<string, unknown>>>()
  private readonly escalations = new Map<string, number[]>()

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

  async getEscalationHistory(key: string): Promise<number[]> {
    return [...(this.escalations.get(key) ?? [])]
  }

  async setEscalationHistory(key: string, timestamps: number[]): Promise<void> {
    this.escalations.set(key, [...timestamps])
  }
}
