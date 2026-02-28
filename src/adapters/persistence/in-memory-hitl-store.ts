import type { HITLStore, HITLStoredRequest } from '../../ports/hitl-store'

export class InMemoryHITLStore implements HITLStore {
  private readonly rows = new Map<string, HITLStoredRequest>()

  async save(request: HITLStoredRequest): Promise<void> {
    this.rows.set(request.id, { ...request })
  }

  async get(id: string): Promise<HITLStoredRequest | null> {
    const row = this.rows.get(id)
    return row ? { ...row } : null
  }
}
