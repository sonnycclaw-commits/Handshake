# WORKFLOWS (Post-Build Operating Contract)

Purpose: canonical runtime behavior for builders/operators after initial build.

Use this doc to answer:
- how Handshake should behave in production,
- what clients must send,
- what failures mean,
- what to do next.

---

## WF-001 — Submit Governed Request

### Story
As an agent/runtime, I submit an action request and receive deterministic governance output.

### Preconditions
- Valid request shape (`requestId`, `principalId`, `agentId`, `actionType`, `payloadRef`, `timestamp`).

### Happy Path
1. `POST /workflow/requests`
2. Handshake evaluates policy + trust context.
3. Returns decision artifact (`allow|deny|escalate`) with `reasonCode`, `responseClass`, and state.

### Failure Branches
- Invalid shape -> `trust_context_invalid_request_shape`
- Missing bindings -> `trust_context_missing_binding`

### Operator/Client Action
- Fix request structure; do not retry malformed payloads unchanged.

---

## WF-002 — Read Decision Context / Evidence (Protected Read)

### Story
As an operator agent/client, I read request state, decision-room context, and evidence timeline.

### Preconditions
- `x-identity-envelope` required.

### Happy Path
- `GET /workflow/requests/{requestId}`
- `GET /workflow/decision-room/{requestId}`
- `GET /workflow/evidence/{requestId}`

### Failure Branches
- Missing envelope -> `security_missing_identity_envelope` (401)
- Invalid envelope -> `security_invalid_identity_envelope` (401)
- Cross-principal read without qualifying scope -> `security_read_scope_denied` (403)
- Tenant mismatch on tenant-scoped reads -> `security_read_tenant_mismatch` (403)

Read scope hierarchy:
- `workflow:read:self`: self-only
- `workflow:read:tenant`: cross-principal within same tenant
- `workflow:read:any`: admin global; non-admin backward-compat behaves tenant-scoped

### Action
- Inject canonical identity envelope from trusted middleware and retry once.

---

## WF-003 — Resolve HITL Decision Action

### Story
As a human/operator path, I resolve escalated requests.

### Preconditions
- `x-identity-envelope`
- Optional `x-idempotency-key` (recommended)

### Happy Path
1. `POST /workflow/decision-room/action`
2. If action is valid and state mutable, request resolves.
3. Returns status `ok` + artifact.

### Failure Branches
- Replay detected -> `security_replay_detected` (409)
- Terminal immutable -> `hitl_terminal_state_immutable` (409)
- Invalid action shape -> `trust_context_invalid_request_shape` (400)

### Action
- For replay: determine if same attempt vs new attempt; new logical attempt needs new idempotency key/new request.

---

## WF-004 — Apply Policy (Privileged Internal Transition)

### Story
As a platform/service actor, I apply policy under signed internal trust.

### Preconditions
- `x-identity-envelope`
- `x-internal-trust-context` (signed, valid, not expired/replayed)

### Happy Path
1. `POST /policy/apply`
2. Trust token + identity validated.
3. Policy version persisted and audited.

### Failure Branches
- Missing/invalid trust context -> `security_missing_internal_trust_context` / `security_invalid_internal_trust_context`
- Expired token -> `security_internal_trust_context_expired`
- Replay/JTI reused -> `security_replay_detected`
- Replay guard store unavailable -> `security_replay_guard_unavailable` (fail-closed)

### Action
- Do not bypass trust checks. Restore signer/guard path first.

---

## WF-005 — Replay/Idempotency Contract

### Story
As a client, retries must be safe and deterministic.

### Rules
- Replay guard is authoritative and fail-closed.
- Duplicate key/JTI returns deterministic conflict/block.
- Guard unavailability returns fail-closed security error.

### Action
- Use clear idempotency strategy per logical action attempt.

---

## WF-006 — Incident Path: Replay Guard Unavailable

### Trigger
`security_replay_guard_unavailable`

### Required Response
1. Stop privileged mutation retries.
2. Run operations playbook (`docs/OPERATIONS.md`).
3. Restore D1 replay guard path.
4. Re-run gates before resuming normal flow.

---

## WF-007 — Cross-Agent Visibility Constraint

### Principle
Agent A must not read Agent B sensitive flow context unless explicitly authorized by policy/scope.

### Current posture
- Treat unauthorized cross-agent read as deny/fail-closed.
- Keep access auditable.

---

## WF-008 — Delegation Boundary (Current Guardrails)

### Principle
Delegated authority never exceeds delegator authority.

### Rules
- Scope subset only
- Time-bounded delegation
- Auditable delegation events
- On ambiguity: fail-closed

---

## Response Class Handling (Client Contract)

- `ok` -> proceed
- `retryable` -> bounded retry with backoff
- `blocked` -> remediate/escalate
- `unknown` -> fail-closed; run contract drift checks

---

## Source of Truth Links

- API schema: `openapi/handshake.v1.yaml`
- Contract rules: `docs/CONTRACT.md`
- Operational actions: `docs/OPERATIONS.md`
- Release/edge quality: `docs/QUALITY.md`


## Reason/Status determinism

All known reason codes must map to deterministic HTTP status and response class. Unknown mappings are treated as contract failures and blocked in CI.
