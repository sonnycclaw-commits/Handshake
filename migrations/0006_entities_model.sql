-- Migration 0006: Entity model (type-agnostic) + interfaces + agent representation

CREATE TABLE IF NOT EXISTS entities (
  entity_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  legal_name TEXT,
  owner_principal_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  trust_state TEXT NOT NULL DEFAULT 'unknown',
  exposure_score REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entities_owner ON entities(owner_principal_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type, updated_at);

CREATE TABLE IF NOT EXISTS entity_interfaces (
  interface_id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  locator TEXT NOT NULL,
  verification_state TEXT NOT NULL DEFAULT 'unverified',
  auth_mode TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(entity_id) REFERENCES entities(entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_interfaces_entity ON entity_interfaces(entity_id, updated_at);

CREATE TABLE IF NOT EXISTS agent_entity_representations (
  representation_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  interface_ids_json TEXT,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER,
  FOREIGN KEY(entity_id) REFERENCES entities(entity_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_entity_active ON agent_entity_representations(entity_id, revoked_at, issued_at);
CREATE INDEX IF NOT EXISTS idx_agent_entity_agent ON agent_entity_representations(agent_id, issued_at);
