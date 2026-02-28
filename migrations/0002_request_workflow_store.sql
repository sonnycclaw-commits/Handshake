-- Migration 002: Request workflow durable store (WF5 C1)

CREATE TABLE IF NOT EXISTS request_workflow_requests (
  request_id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload_ref TEXT NOT NULL,
  request_timestamp INTEGER NOT NULL,
  state TEXT NOT NULL,
  terminal INTEGER NOT NULL DEFAULT 0,
  decision_context_hash TEXT NOT NULL,
  hitl_request_id TEXT,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rwr_principal_agent ON request_workflow_requests(principal_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_rwr_state ON request_workflow_requests(state);
CREATE INDEX IF NOT EXISTS idx_rwr_context_hash ON request_workflow_requests(decision_context_hash);

CREATE TABLE IF NOT EXISTS request_workflow_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES request_workflow_requests(request_id)
);

CREATE INDEX IF NOT EXISTS idx_rwa_request_id ON request_workflow_audit_events(request_id);

CREATE TABLE IF NOT EXISTS request_workflow_escalation_buckets (
  bucket_key TEXT PRIMARY KEY,
  timestamps_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS request_workflow_lineage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES request_workflow_requests(request_id)
);

CREATE INDEX IF NOT EXISTS idx_rwl_request_id ON request_workflow_lineage_events(request_id);


CREATE TABLE IF NOT EXISTS request_workflow_hitl_requests (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  tier INTEGER NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  approver_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rwh_principal_status ON request_workflow_hitl_requests(principal_id, status);
CREATE INDEX IF NOT EXISTS idx_rwh_expires_at ON request_workflow_hitl_requests(expires_at);
