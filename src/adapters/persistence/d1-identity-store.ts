import type {
  CreateLinkageInput,
  IdentityStore,
  LinkageRecord,
  LinkageWithTrust,
  TrustSignals
} from '../../ports/identity-store'

type LinkageRow = {
  id: string
  agent_id: string
  owner_provider: string
  owner_id: string | null
  owner_display_name: string | null
  privacy_level: string
  verified_at: string
  revoked_at?: string | null
}

type TrustRow = {
  agents_owned?: number | null
  offers_published?: number | null
  successful_trades?: number | null
  reputation_score?: number | null
}

type LinkageWithTrustRow = LinkageRow & TrustRow

export class D1IdentityStore implements IdentityStore {
  constructor(private readonly db: D1Database) {}

  async getActiveLinkageByAgentId(agentId: string): Promise<LinkageRecord | null> {
    const row = await this.db
      .prepare(`
        SELECT *
        FROM linkages
        WHERE agent_id = ? AND revoked_at IS NULL
      `)
      .bind(agentId)
      .first<LinkageRow>()

    return row ? mapLinkageRow(row) : null
  }

  async getActiveLinkageByAgentIdAndOwner(
    agentId: string,
    ownerProvider: string,
    ownerId: string
  ): Promise<LinkageRecord | null> {
    const row = await this.db
      .prepare(`
        SELECT *
        FROM linkages
        WHERE agent_id = ?
          AND owner_provider = ?
          AND owner_id = ?
          AND revoked_at IS NULL
      `)
      .bind(agentId, ownerProvider, ownerId)
      .first<LinkageRow>()

    return row ? mapLinkageRow(row) : null
  }

  async getActiveLinkageWithTrustByAgentId(agentId: string): Promise<LinkageWithTrust | null> {
    const row = await this.db
      .prepare(`
        SELECT
          l.*,
          t.agents_owned,
          t.offers_published,
          t.successful_trades,
          t.reputation_score
        FROM linkages l
        LEFT JOIN trust_signals t
          ON l.owner_provider = t.owner_provider
          AND l.owner_id = t.owner_id
        WHERE l.agent_id = ? AND l.revoked_at IS NULL
      `)
      .bind(agentId)
      .first<LinkageWithTrustRow>()

    if (!row) return null

    return {
      linkage: mapLinkageRow(row),
      trust: mapTrustRow(row)
    }
  }

  async createLinkage(input: CreateLinkageInput): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO linkages (id, agent_id, owner_provider, owner_id, owner_display_name, privacy_level, verified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        input.id,
        input.agentId,
        input.ownerProvider,
        input.ownerId,
        input.ownerDisplayName,
        input.privacyLevel,
        input.verifiedAt
      )
      .run()
  }

  async incrementAgentsOwned(ownerProvider: string, ownerId: string): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO trust_signals (id, owner_provider, owner_id, agents_owned, offers_published, successful_trades)
        VALUES (?, ?, ?, 1, 0, 0)
        ON CONFLICT(owner_provider, owner_id) DO UPDATE SET
          agents_owned = agents_owned + 1,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(randomId(16), ownerProvider, ownerId)
      .run()
  }
}

function mapLinkageRow(row: LinkageRow): LinkageRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    ownerProvider: row.owner_provider,
    ownerId: row.owner_id ?? null,
    ownerDisplayName: row.owner_display_name ?? null,
    privacyLevel: row.privacy_level,
    verifiedAt: row.verified_at,
    revokedAt: row.revoked_at ?? null
  }
}

function mapTrustRow(row: TrustRow): TrustSignals {
  return {
    agentsOwned: row.agents_owned ?? 0,
    offersPublished: row.offers_published ?? 0,
    successfulTrades: row.successful_trades ?? 0,
    reputationScore: row.reputation_score ?? 0
  }
}

function randomId(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
