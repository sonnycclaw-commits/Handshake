-- Migration 0004: WF5 metrics projection layer (H7/H8)

CREATE TABLE IF NOT EXISTS metrics_events (
  event_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  decision TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  reason_family TEXT NOT NULL,
  risk_tier TEXT NOT NULL,
  is_terminal INTEGER NOT NULL,
  has_valid_lineage INTEGER NOT NULL,
  incident_detected_ts_ms INTEGER,
  terminal_decision_ts_ms INTEGER,
  human_minutes REAL,
  compute_cost_units REAL,
  escalation_overhead_units REAL,
  schema_version TEXT NOT NULL,
  projector_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metrics_events_timestamp ON metrics_events(timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_metrics_events_reason_family ON metrics_events(reason_family);
CREATE INDEX IF NOT EXISTS idx_metrics_events_risk_tier ON metrics_events(risk_tier);

CREATE TABLE IF NOT EXISTS metrics_rollups_hourly (
  bucket_start_ms INTEGER NOT NULL,
  metric_name TEXT NOT NULL,
  dimension_key TEXT NOT NULL,
  value_real REAL NOT NULL,
  sample_count INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  projector_version TEXT NOT NULL,
  computed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (bucket_start_ms, metric_name, dimension_key)
);

CREATE INDEX IF NOT EXISTS idx_metrics_rollups_hourly_metric ON metrics_rollups_hourly(metric_name, bucket_start_ms);

CREATE TABLE IF NOT EXISTS metrics_rollups_daily (
  bucket_start_ms INTEGER NOT NULL,
  metric_name TEXT NOT NULL,
  dimension_key TEXT NOT NULL,
  value_real REAL NOT NULL,
  sample_count INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  projector_version TEXT NOT NULL,
  computed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (bucket_start_ms, metric_name, dimension_key)
);

CREATE INDEX IF NOT EXISTS idx_metrics_rollups_daily_metric ON metrics_rollups_daily(metric_name, bucket_start_ms);
