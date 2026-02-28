-- Migration 0003: Identity linkage hardening indexes for Clerk cutover

CREATE INDEX IF NOT EXISTS idx_linkages_agent_revoked
  ON linkages(agent_id, revoked_at);

CREATE INDEX IF NOT EXISTS idx_linkages_owner_revoked
  ON linkages(owner_provider, owner_id, revoked_at);
