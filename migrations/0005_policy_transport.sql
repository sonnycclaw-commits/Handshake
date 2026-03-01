-- Migration 0005: Policy transport persistence and audit trail (WF5-API-03)

CREATE TABLE IF NOT EXISTS policy_active_configs (
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  rules_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scope, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_policy_active_scope ON policy_active_configs(scope, scope_id);

CREATE TABLE IF NOT EXISTS policy_versions (
  version_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  rules_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_versions_scope ON policy_versions(scope, scope_id, created_at);

CREATE TABLE IF NOT EXISTS policy_audit_events (
  event_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_audit_scope ON policy_audit_events(scope, scope_id, created_at);
