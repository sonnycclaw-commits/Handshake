# Handshake Backend API — Frontend Integration Guide

This is the frontend-facing contract for Handshake backend capabilities.

Canonical source of truth:
- OpenAPI: `openapi/handshake.v1.yaml`

## Base Principles

1. Treat `reasonCode` + `responseClass` as machine contract.
2. Protected routes require `x-identity-envelope`.
3. `POST /policy/apply` additionally requires `x-internal-trust-context`.
4. Use `x-idempotency-key` on decision actions to prevent replay duplication.
5. Fail closed on unknown response shapes.

---

## Identity Envelope Header

Header name: `x-identity-envelope`

JSON shape (minimum practical):
```json
{
  "principalId": "user_or_operator_id",
  "subjectType": "human",
  "roles": ["operator"],
  "scopes": ["workflow:read:tenant", "workflow:resolve"],
  "tenantId": "tenant-a"
}
```

---

## Workflow Endpoints

### 1) Submit request
`POST /workflow/requests`

Use to create a governed request.

### 2) Get request state
`GET /workflow/requests/{requestId}`

Protected: `x-identity-envelope`

### 3) Get decision room
`GET /workflow/decision-room/{requestId}`

Protected: `x-identity-envelope`

### 4) Resolve decision action
`POST /workflow/decision-room/action`

Protected: `x-identity-envelope`
Optional replay guard: `x-idempotency-key`

Body:
```json
{
  "requestId": "req-123",
  "hitlRequestId": "hitl-123",
  "action": "approve"
}
```

### 5) Get evidence timeline
`GET /workflow/evidence/{requestId}`

Protected: `x-identity-envelope`

### 6) Authorize execution (artifact gate)
`POST /workflow/authorize-execution`

Used by backend/service flows before privileged continuation.

---

## Policy Endpoints

### 1) Read policy config
`GET /policy/config?scope=global|agent&scopeId=...`

### 2) Simulate policy
`POST /policy/simulate`

### 3) Apply policy
`POST /policy/apply`

Protected:
- `x-identity-envelope`
- `x-internal-trust-context`

---

## Metrics Endpoints

### 1) Summary
`GET /metrics/summary?window=24h|7d|30d`

### 2) Series
`GET /metrics/series?metric=...&bucket=hour|day&window=...`

Allowed `metric` values:
- `uair`
- `airt_p50_ms`
- `airt_p95_ms`
- `gar`
- `tca`
- `security_denial_total`
- `security_replay_detected_total`
- `security_replay_guard_unavailable_total`

Invalid metric returns `400` with `error=invalid_metric_query`.

### 3) Reason distribution
`GET /metrics/reasons?window=24h|7d|30d`

---

## Operator Read Endpoints

- `GET /agents`
- `GET /agents/{agentId}`
- `GET /entities`
- `GET /entities/{entityId}`

---

## Error Contract (frontend handling)

Typical non-2xx shape:
```json
{
  "status": "error",
  "error": "security_read_scope_denied",
  "reasonCode": "security_read_scope_denied",
  "responseClass": "blocked",
  "message": "Read access denied"
}
```

Frontend handling:
- `responseClass=ok` -> proceed
- `responseClass=retryable` -> bounded retry/backoff
- `responseClass=blocked` -> show actionable state/escalation path
- `responseClass=unknown` -> fail closed, log contract drift

---

## Recommended Frontend Integration Sequence

1. Start with workflow rail (`submit -> request -> decision-room -> action -> evidence`).
2. Add policy read/simulate/apply with internal trust token path.
3. Add metrics dashboard (`summary`, `series`, `reasons`).
4. Add operator read views (`agents`, `entities`).

---

## Readiness Snapshot

Backend is frontend-ready for API integration with enforced gates:
- prod gate
- env matrix
- release readiness
- invariants
- release checklist verification
- 24h watch config verification

For exact schemas and response types, always generate from OpenAPI (`openapi/handshake.v1.yaml`).
