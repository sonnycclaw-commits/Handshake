import { describe, it, expect } from 'vitest'
import app from '@/index'

type Env = {
  DB: D1Database
  KV: KVNamespace
  ENVIRONMENT: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  JWT_PRIVATE_KEY: string
  JWT_PUBLIC_KEY: string
  JWT_KEY_ID: string
  IDENTITY_PROVIDER?: 'legacy' | 'clerk'
  CLERK_JWT_KEY?: string
  CLERK_SECRET_KEY?: string
  CLERK_AUDIENCE?: string
  CLERK_AUTHORIZED_PARTIES?: string
}

class FakeStmt {
  private sql: string
  private db: FakeD1
  private args: unknown[] = []
  constructor(db: FakeD1, sql: string) { this.db = db; this.sql = sql }
  bind(...args: unknown[]) { this.args = args; return this }
  async run() { this.db.run(this.sql, this.args); return { success: true } }
  async first<T>() { return this.db.first<T>(this.sql, this.args) }
  async all<T>() { return { results: this.db.all<T>(this.sql, this.args) } }
}

class FakeD1 {
  entities = new Map<string, any>()
  interfaces = new Map<string, any[]>()
  reps = new Map<string, any[]>()
  linkages = new Map<string, any>()
  requests = new Map<string, any>()

  constructor() {
    const now = Date.now()
    this.entities.set('ent_renoz', {
      entity_id: 'ent_renoz',
      entity_type: 'business',
      display_name: 'RENOZ Energy',
      legal_name: 'RENOZ Energy Pty Ltd',
      owner_principal_id: 'p_joel',
      status: 'active',
      trust_state: 'established',
      exposure_score: 0.21,
      created_at: now - 10_000,
      updated_at: now,
    })

    this.interfaces.set('ent_renoz', [
      {
        interface_id: 'if_1',
        entity_id: 'ent_renoz',
        kind: 'api',
        label: 'Main API',
        locator: 'https://api.renoz.example',
        verification_state: 'verified',
        auth_mode: 'oauth',
        created_at: now - 9000,
        updated_at: now - 1000,
      }
    ])

    this.reps.set('ent_renoz', [
      {
        representation_id: 'rep_1',
        agent_id: 'agent_renoz_ops',
        entity_id: 'ent_renoz',
        principal_id: 'p_joel',
        scopes_json: JSON.stringify(['ops:read', 'ops:approve']),
        interface_ids_json: JSON.stringify(['if_1']),
        issued_at: now - 8000,
        expires_at: null,
        revoked_at: null,
      }
    ])
  }

  prepare(sql: string) { return new FakeStmt(this, sql) }

  run(_sql: string, _args: unknown[]) {}

  first<T>(sql: string, args: unknown[]): T | null {
    if (sql.includes('FROM entities WHERE entity_id = ?')) {
      return (this.entities.get(String(args[0])) ?? null) as T | null
    }
    return null
  }

  all<T>(sql: string, args: unknown[]): T[] {
    if (sql.includes('FROM entities ORDER BY updated_at DESC')) {
      return Array.from(this.entities.values()) as T[]
    }

    if (sql.includes('LEFT JOIN entity_interfaces')) {
      return Array.from(this.entities.keys()).map((id) => ({
        entity_id: id,
        interface_count: (this.interfaces.get(id) ?? []).length,
        rep_count: (this.reps.get(id) ?? []).filter((r) => r.revoked_at == null).length,
      })) as T[]
    }

    if (sql.includes('FROM entity_interfaces WHERE entity_id = ?')) {
      const id = String(args[0])
      return (this.interfaces.get(id) ?? []) as T[]
    }

    if (sql.includes('FROM agent_entity_representations')) {
      const id = String(args[0])
      return (this.reps.get(id) ?? []) as T[]
    }

    // compatibility
    if (sql.includes('SELECT agent_id, revoked_at FROM linkages')) {
      return Array.from(this.linkages.values()) as T[]
    }

    return []
  }
}

function makeEnv(): Env {
  return {
    DB: new FakeD1() as unknown as D1Database,
    KV: {} as KVNamespace,
    ENVIRONMENT: 'test',
    GOOGLE_CLIENT_ID: 'x',
    GOOGLE_CLIENT_SECRET: 'x',
    GITHUB_CLIENT_ID: 'x',
    GITHUB_CLIENT_SECRET: 'x',
    JWT_PRIVATE_KEY: 'x',
    JWT_PUBLIC_KEY: 'x',
    JWT_KEY_ID: 'x',
    IDENTITY_PROVIDER: 'legacy',
  }
}

describe('Entities rail transport (type-agnostic)', () => {
  it('lists entities with type-agnostic model fields', async () => {
    const env = makeEnv()
    const res = await app.fetch(new Request('http://local/entities'), env)
    expect(res.status).toBe(200)

    const body: any = await res.json()
    expect(Array.isArray(body.entities)).toBe(true)
    expect(body.entities.length).toBeGreaterThan(0)

    const entity = body.entities[0]
    expect(entity.entityId).toBe('ent_renoz')
    expect(typeof entity.entityType).toBe('string')
    expect(entity.entityType.length).toBeGreaterThan(0)
    expect(typeof entity.interfaceCount).toBe('number')
    expect(typeof entity.representationCount).toBe('number')
  })

  it('returns entity detail with interfaces and representations', async () => {
    const env = makeEnv()
    const res = await app.fetch(new Request('http://local/entities/ent_renoz'), env)
    expect(res.status).toBe(200)

    const body: any = await res.json()
    expect(body.entityId).toBe('ent_renoz')
    expect(Array.isArray(body.interfaces)).toBe(true)
    expect(Array.isArray(body.representations)).toBe(true)
    expect(body.interfaces.length).toBeGreaterThan(0)
    expect(body.representations.length).toBeGreaterThan(0)
  })

  it('returns not found for unknown entity', async () => {
    const env = makeEnv()
    const res = await app.fetch(new Request('http://local/entities/ent_unknown'), env)
    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.reasonCode).toBe('hitl_request_not_found')
    expect(body.error).toBe('hitl_request_not_found')
  })
})
