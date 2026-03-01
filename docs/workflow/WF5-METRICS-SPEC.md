# WF5 Metrics Spec (H7/H8)

Status: Draft v1
Date: 2026-02-28

## Objective
Define deterministic, auditable governance metrics from canonical decision events.

## Metrics (v1)

### 1) UAIR — Unsafe Action Intercept Rate
- Definition: `(denied + escalated) risky_requests / risky_requests`
- Numerator class: requests with decision in `{deny, escalate}` and risk tier in `{high,critical}`
- Denominator class: all requests with risk tier in `{high,critical}`

### 2) AIRT — Agent Incident Response Time
- Definition: `terminal_decision_ts - incident_detected_ts`
- Computed for escalated high-risk incidents
- Report P50/P95 by period

### 3) GAR — Governed Autonomy Ratio
- Definition: `autonomous_actions_with_valid_lineage / total_autonomous_actions`
- Valid lineage requires known reason code + immutable terminal state evidence

### 4) TCA — Trust Cost per Action
- Definition: `(human_minutes + compute_cost_units + escalation_overhead_units) / governed_actions`
- Unitized approximation first; real cost model later

## Event Contract
Canonical metrics event fields:
- `event_id` (string, unique, idempotency key)
- `request_id` (string)
- `timestamp_ms` (number)
- `decision` (`allow|deny|escalate`)
- `reason_code` (known code)
- `reason_family` (`trust_context|policy|security|hitl|adapter|unknown`)
- `risk_tier` (`low|medium|high|critical|unknown`)
- `is_terminal` (boolean)
- `has_valid_lineage` (boolean)
- `incident_detected_ts_ms` (nullable number)
- `terminal_decision_ts_ms` (nullable number)
- `human_minutes` (nullable number)
- `compute_cost_units` (nullable number)
- `escalation_overhead_units` (nullable number)

## Invariants
1. Append-only metrics events.
2. Rollups reproducible from events.
3. Unknown reason codes not dropped (bucketed as `unknown`).
4. No PII in metric dimensions.
5. Schema version embedded in events and rollups.

## Query Surfaces (H8)
- `GET /metrics/summary?window=24h|7d|30d`
- `GET /metrics/series?metric=UAIR|AIRT|GAR|TCA&bucket=hour|day`
- `GET /metrics/reasons?window=7d`

## Performance Targets
- Summary query p95 < 250ms
- Series query p95 < 300ms (30d daily buckets)

## Versioning
- `METRICS_SCHEMA_VERSION = v1`
- Rollups store schema + projector version for audit replay


## W3 C2 Dashboard Contract

### Summary Surface (`GET /metrics/summary`)
Required output fields:
- `window`
- `schemaVersion`
- `projectorVersion`
- `uair`, `airtP50Ms`, `airtP95Ms`, `gar`, `tca`
- `totalEvents`
- `denialEvents`
- `replayDetectedEvents`
- `replayGuardUnavailableEvents`

These counters provide direct security trend visibility for denial and replay failure classes.

### Series Surface (`GET /metrics/series`)
Supported metric query values (enforced):
- `uair`
- `airt_p50_ms`
- `airt_p95_ms`
- `gar`
- `tca`
- `security_denial_total`
- `security_replay_detected_total`
- `security_replay_guard_unavailable_total`

Invalid metric names fail with `invalid_metric_query` (400, `responseClass=blocked`).


## W3 C3 Alert Thresholds

Deterministic alert conditions:
- `alert_replay_guard_unavailable`
  - Trigger: `replayGuardUnavailableTotal >= replayGuardUnavailableAlertCount`
- `alert_denial_spike`
  - Trigger: `securityDenialTotal / totalRequests > maxDenialRate`
- `alert_tenant_mismatch_spike`
  - Trigger: `tenantMismatchDeniedTotal / totalRequests > maxTenantMismatchRate`

Default thresholds:
- `replayGuardUnavailableAlertCount = 1`
- `maxDenialRate = 0.4`
- `maxTenantMismatchRate = 0.1`
