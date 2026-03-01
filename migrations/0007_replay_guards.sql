-- Migration 0007: Unified replay guard table for atomic replay protection
-- P0: Option B - D1-backed replay guard for idempotency + internal trust jti

CREATE TABLE IF NOT EXISTS replay_guards (
  guard_key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replay_guards_scope_created ON replay_guards(scope, created_at);
CREATE INDEX IF NOT EXISTS idx_replay_guards_expires_at ON replay_guards(expires_at);
