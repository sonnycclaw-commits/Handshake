# Request Workflow TDD Spec (Backend)

Status: Draft (RED phase)
Date: 2026-02-28

## Scope
Backend-only implementation of canonical request workflow:
`receive -> classify -> evaluate -> resolve -> record -> return`

No frontend/UI work in this scope.

---
## Success Target (Postural, Agent-First)

This workflow succeeds when agents treat Handshake as a native control plane, not optional middleware.

Success conditions:
1. **Behavioral certainty:** privileged requests deterministically resolve to `allow|deny|escalate`.
2. **Trust-preserving throughput:** low-risk auto-path remains fast; high-risk escalation is precise (not spammy).
3. **Runtime invariants:** no privileged side effect without decision artifact, timeout/uncertainty fail closed, terminal immutability holds.
4. **Agent-operable semantics:** reason codes are stable branch keys and retry policy is class-driven.
5. **Compounding signal quality:** request/outcome traces are consistent enough to improve policy defaults over time.

---


## Premortem Summary (What kills this design)

1. **Parallel rails**: teams add a "quick path" and bypass policy/HITL/audit rails.
2. **Non-determinism creep**: same request resolves differently across surfaces/runs.
3. **Reason-code entropy**: codes become prose, not machine-branchable keys.
4. **Escalation deadlocks**: pending HITL does not truly block privileged continuation.
5. **Sensitive-info drift**: confidential data handling forks into ad hoc logic.
6. **State inconsistency**: audit and lineage diverge under partial failures.

Design response: this spec enforces a **single decision rail** and **shared primitives only**.

---

## Integration-First Principle (Non-Negotiable)

Build by integrating existing Handshake infrastructure, not parallel systems.

### Reuse Existing Components
- Policy evaluation rails (`policy-evaluator`)
- HITL workflow and queue semantics
- Quorum/delegated governance (phase 6 where required)
- Audit + lineage patterns
- Fail-closed error and terminal-state behavior
- Vault adapter execution boundaries
- Response sanitization service

### Do Not Rebuild
- New approval subsystem
- New audit subsystem
- New policy engine
- New identity/governance primitives
- New sensitive-action side pipeline

---

## Canonical E2E Decision Tree

All privileged agent requests MUST pass this tree:

1. **Receive / Validate**
   - Validate shape, bindings, timestamp window, idempotency key.
   - Invalid -> `deny` (fail-closed).

2. **Classify**
   - Derive normalized `actionClass`:
     - `low_risk_operation`
     - `sensitive_info_access`
     - `credential_mediated_external_effect`
     - `irreversible_or_high_impact`

3. **Evaluate** (existing policy + trust rails)
   - Determine decision class + tier + reasonCode.
   - Outcomes:
     - `allow`
     - `deny`
     - `escalate`

4. **Resolve**
   - `allow` -> execute through existing adapter/use-case path.
   - `deny` -> return deterministic terminal rejection.
   - `escalate` -> create HITL request; block branch pending terminal state.

5. **Record**
   - Append audit event (every request)
   - Append lineage event (every terminal transition)

6. **Return**
   - Return normalized result object and branch-driving artifacts.

---

## Workflow Contract

Request resolves to exactly one outcome class:
- `allow`
- `deny`
- `escalate`

Mandatory response fields:
- `requestId`
- `decision`
- `reasonCode`
- `tier`
- `timestamp`
- `decisionContextHash` (determinism boundary)
- optional `hitlRequestId` / `txnId`

### Determinism Boundary
`decisionContextHash` MUST be derived from stable inputs only:
- normalized request payload
- policy version
- trust posture snapshot id
- timestamp bucket policy (documented skew rules)

Same context hash => same decision class.

---

## State Model (authoritative)

- `submitted`
- `allowed_terminal`
- `denied_terminal`
- `escalated_pending`
- `escalated_approved_terminal`
- `escalated_rejected_terminal`
- `escalated_expired_terminal`

Rules:
1. Terminal states are immutable.
2. Late approvals after terminal reject/expire resolve to deny.
3. Pending escalation blocks privileged continuation.

---

## Reason-Code Contract

Reason codes are machine-branch keys, not free text.

Requirements:
1. Non-empty, standardized, versioned taxonomy.
2. Deterministic mapping from violation/eval condition.
3. Mapped remediation class for runtime behavior.

Minimum classes:
- `trust_context_*`
- `policy_*`
- `security_*`
- `hitl_*`
- `adapter_*`

---

## Test Matrix (RED)

### RW-001 Receive/Validation
- Invalid request shape -> deny (fail-closed)
- Missing principal/agent binding -> deny
- Stale/future skew timestamp -> deny
- Duplicate idempotency key replay -> deterministic prior terminal result

### RW-002 Policy Decision
- In-policy low-risk request -> allow
- Sensitive info below approved threshold/path -> allow or escalate per policy
- Policy violation -> deny
- Boundary request -> escalate

### RW-003 HITL Resolution
- Escalated request -> pending HITL
- HITL approve -> allow terminal
- HITL reject -> deny terminal
- HITL timeout -> deny terminal
- Late approve after terminal -> deny

### RW-004 Non-Bypass
- Privileged action outside handshake path -> deny + security audit event
- Side-channel adapter invocation attempt -> deny + security event

### RW-005 Agent Behavior Contract
- `allow` -> continuation artifact returned
- `deny` -> remediation-classifiable reason code
- `escalate` -> pending state blocks continuation

### RW-006 Audit + Lineage
- Every request emits auditable decision event
- Every terminal transition emits lineage-safe immutable record
- Reason code always non-empty and standardized
- Audit/lineage append failures preserve fail-closed consistency

### RW-007 Determinism
- Same request + same policy + same context hash -> same decision class
- Cross-surface parity (API/chat/workflow) for identical context hash

### RW-008 Utility/Safety Guard
- Low-risk auto-path remains available
- Fail-closed invariants remain strict
- Escalation burden remains within agreed tolerance envelope

### RW-009 Sensitive Information Branch
- Confidential data access request classified correctly
- Unauthorized sensitive scope -> deny
- Ambiguous sensitive context -> escalate (not allow)
- Sanitized result contract preserved (no data leakage)

### RW-010 Integration-Only Enforcement
- No duplicate subsystem instantiation in request path
- Request workflow composes through existing policy/HITL/audit/governance services

### RW-011 Decision Artifact Gate
- Privileged execution without valid decision artifact -> deny
- Artifact with mismatched `decisionContextHash` -> deny
- Non-allow artifact cannot drive privileged side effect

### RW-012 Escalation Precision / Fatigue Guard
- Repeated boundary requests trigger flood/throttle controls
- Low-risk auto-path throughput remains available under normal load
- Escalation ratio remains within configured budget envelope

### RW-013 Agent Contract Stability
- Reason-code class maps to deterministic retry policy
- Unknown reason classes fail closed (`do_not_retry`)
- `deny` and `escalate` block speculative privileged continuation

---

## Definition of Done

1. RED tests exist for RW-001..RW-010 and fail for expected reasons.
2. Existing suites remain runnable.
3. No FE artifacts introduced.
4. No duplicate infrastructure introduced.
5. Decision-context hash and reason-code taxonomy documented and test-enforced.
6. E2E state transitions validated for allow/deny/escalate across sensitive + HITL branches.
7. WF-05 success metrics are measurable (determinism, escalation burden, invariant violations).

---

## Planned Test Files

- `tests/unit/workflow/request-workflow.red.test.ts`
- `tests/unit/workflow/request-decision-context.red.test.ts`
- `tests/unit/workflow/request-reason-codes.red.test.ts`
- `tests/integration/workflow/request-workflow-enforcement.red.integration.test.ts`
- `tests/integration/workflow/request-workflow-infra-compat.red.integration.test.ts`
- `tests/integration/workflow/request-cross-surface-parity.red.integration.test.ts`
- `tests/integration/workflow/request-sensitive-branch.red.integration.test.ts`
- `tests/integration/workflow/request-decision-artifact-gate.red.integration.test.ts`
- `tests/integration/workflow/request-escalation-budget.red.integration.test.ts`
- `tests/unit/workflow/request-agent-contract-stability.red.test.ts`

## Production Transport Contract (WF-05 + Operator Surface)

The following HTTP contract is required to make workflow capabilities operable by frontend clients.

### A) Workflow Rail (required)
1. `POST /workflow/requests`
   - Intent: submit canonical request for decisioning.
   - Must return: `requestId, decision, reasonCode, tier, timestamp, decisionContextHash, hitlRequestId?, txnId?`.
2. `GET /workflow/requests/:requestId`
   - Intent: fetch canonical persisted request state and latest artifact.
3. `GET /workflow/decision-room/:requestId`
   - Intent: operator-facing decision context for one request.
   - Must include: request summary, risk tier, reason family, current artifact.
4. `POST /workflow/decision-room/action`
   - Intent: resolve pending escalation branch.
   - Canonical action contract: `approve|reject` (timeout is system-driven).
5. `GET /workflow/evidence/:requestId`
   - Intent: ordered replayable evidence timeline from audit + lineage events.

### B) Policy Rail (required for production governance)
1. `GET /policy/config`
2. `POST /policy/simulate`
3. `POST /policy/apply`

Policy apply must produce a versioned result and auditable linkage to subsequent decisions.

### C) Metrics Rail (already live)
- `GET /metrics/summary`
- `GET /metrics/series`
- `GET /metrics/reasons`
- `POST /metrics/project`

### D) Operator Read Rails
- Agents read endpoints are in-scope for production completion.
- Entities endpoints are blocked pending explicit entity domain/persistence contract approval.

---

## Product Capability Contract (What the app must do)

1. Give operators clear context for high-risk decisions in one place.
2. Ensure every privileged continuation is decision-artifact gated.
3. Keep decision outcomes deterministic across API/chat/workflow surfaces.
4. Preserve audit + lineage integrity as replayable evidence.
5. Keep escalation precise enough to avoid approval fatigue.
6. Expose policy impact before apply, and trace applied policy versions after apply.

