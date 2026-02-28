# Handshake PRD (Core)

## Purpose
Canonical product requirements for user flows, guardrails, and acceptance criteria.

## Actors
1. Individual Principal
2. Entity Principal
3. Operator / Integrator
4. Agent Runtime

## Core Workflows (Authoritative)
- WF-00 Onboarding first trust proof
- WF-01 Agent bounded execution
- WF-02 Boundary escalation (HITL)
- WF-03 Fail-closed rejection path
- WF-04 Entity governance / delegated approvals
- WF-05 Unified agent request decision workflow (allow|deny|escalate)

## Acceptance Matrix (Flow-Level)

| Flow | Actor | Success Condition | Security Invariant | Proof |
|---|---|---|---|---|
| WF-00 | Individual + Agent + Operator | User reaches first trust proof in <=5 minutes with >=1 policy-governed action | Privileged actions non-bypassable, timeout fail-closed, revoke testable | onboarding unit + integration contract suites |
| WF-01 | Agent + Individual | Valid low-risk request executes and returns sanitized result + txn_id | Agent never receives secret value | integration tests + sanitization tests |
| WF-02 | Agent + Principal | Tier>=3 creates HITL request and resolves via approve/deny/timeout | No implicit allow on timeout | HITL unit + integration tests |
| WF-03 | Agent | Invalid identity/policy/timestamp/ownership denied deterministically | Fail-closed always | policy + adapter failure-mode suites |
| WF-04 | Entity + Operator + Agent | Entity policy enforced with correct approver authority | Unauthorized approver cannot approve | HITL authorization tests + phase6 governance tests |
| WF-05 | Agent + Principal + Operator | All privileged requests resolve via one decision rail and deterministic state machine | No parallel authorization paths; terminal states immutable; same context -> same decision class | workflow unit + integration + cross-surface parity suites |


## Onboarding Acceptance Contract (WF-00)

WF-00 is complete only when all conditions hold:

1. TTFTP <= 5 minutes (p95 measured in onboarding telemetry)
2. User completes >=1 policy-governed workflow
3. >=1 boundary event shown with standardized reason code
4. Revoke/pause control is visible and validated in onboarding context
5. Agent-side policy envelope emitted in machine-readable schema
6. No privileged action executes outside handshake decision path

Design authority for WF-00 details: `docs/onboarding-foundation/ONBOARDING-DESIGN-STANDARD.md`
Test authority for WF-00 details: `docs/onboarding-foundation/ONBOARDING-TDD-SCENARIOS.md`

## Policy Scenario Matrix (v1)

Each scenario must produce deterministic decision/tier/reason.

1. amount within max, allowed category, allowed hour -> allow tier1
2. amount > maxTransaction -> allow+HITL tier3+
3. amount > dailySpendLimit -> deny
4. disallowed category -> deny
5. outside allowed hours -> deny
6. malformed policy -> deny
7. missing amount -> deny
8. negative amount -> deny
9. zero amount read action -> allow tier0/1
10. unknown category with allowlist set -> deny
11. high amount + allowed category -> HITL tier4
12. valid request with stale timestamp -> reject
13. valid request with future-skew timestamp -> reject
14. credential ownership mismatch -> reject
15. unknown credential ref -> reject
16. adapter not connected -> reject
17. missing env config -> reject normalized error
18. invalid env config payload -> reject normalized error
19. HITL approved by correct principal -> approved terminal
20. HITL timeout/no decision -> rejected terminal

## HITL Operational Contract

- States: pending -> approved|rejected|expired(rejected semantic)
- Timeout default: reject
- Approval authority: approver must match required principal (or quorum policy when added)
- Idempotency: terminal states are immutable
- Audit: every transition appends event with request id, actor, timestamp, reason

## WF-05 Unified Request Workflow Contract

All privileged agent actions MUST traverse a single workflow:
`receive -> classify -> evaluate -> resolve -> record -> return`

### WF-05 Decision Outcomes
- `allow`
- `deny`
- `escalate`

### WF-05 Classification Baseline
- `low_risk_operation`
- `sensitive_info_access`
- `credential_mediated_external_effect`
- `irreversible_or_high_impact`

Sensitivity is a branch inside WF-05, not a separate workflow.

### WF-05 Determinism Requirement
Workflow returns `decisionContextHash` derived from stable inputs:
- normalized request payload
- policy version
- trust posture snapshot id
- documented timestamp skew normalization

Equal context hash must produce equal decision class.

### WF-05 Branching/State Requirements
Authoritative states:
- `submitted`
- `allowed_terminal`
- `denied_terminal`
- `escalated_pending`
- `escalated_approved_terminal`
- `escalated_rejected_terminal`
- `escalated_expired_terminal`

Rules:
1. Terminal states immutable.
2. Late approvals after terminal reject/expire denied.
3. Pending escalation blocks privileged continuation.
4. Every terminal state appends lineage-safe immutable event.

### WF-05 Reason-Code Requirements
- Non-empty standardized code for every outcome.
- Machine-branchable taxonomy (not free-text-only).
- Stable versioned mapping to remediation classes.

### WF-05 Integration Constraint
WF-05 must compose existing subsystems only:
- policy evaluator
- HITL workflow
- governance/quorum rails
- audit + lineage services
- sanitization service

No new parallel approval/audit/policy rail is permitted.

### WF-05 Success Metrics (Operational)
WF-05 promotion requires sustained pass on:
1. Deterministic decision class parity for equal `decisionContextHash`.
2. Privileged bypass success rate = 0.
3. Timeout fail-closed correctness = 100%.
4. Terminal immutability violations = 0.
5. Escalation burden within configured operator tolerance.
6. Low-risk auto-path throughput preserved (no regression beyond agreed threshold).

## Non-Goals (Current Scope)
- Agent capability envelope framework (future design note)
- Multi-channel delivery guarantees beyond baseline timeout semantics
- Full quorum implementation (planned in entity governance expansion)


## Phase 5 Acceptance Addendum — Transparent Trust Posture

Phase 5 must expose transparent operational trust posture for operators/integrators:

| Requirement | Acceptance Condition | Proof |
|---|---|---|
| Raw telemetry visibility | Returns explicit activity/failure/auth/HITL timeout metrics | phase5 unit + integration tests |
| Deterministic posture band | Classifies `stable|degraded|unstable` from documented thresholds | phase5 deterministic tests |
| Explainability | Includes `drivers[]` and `recommendedMode` for every posture output | phase5 contract tests |
| Policy-safe mapping | `recommendedMode` maps to `auto|hitl_required|restricted` and never weakens fail-closed behavior | policy+phase5 tests |
| Recovery semantics | Supports fast-down / slow-up posture transitions | phase5 transition tests |

Design constraint: no opaque proprietary trust score as the primary operator signal.

## Phase 6 Acceptance Addendum — Governance Hardening Closure

Phase 6 must satisfy governance-grade safety and consistency constraints:

| Requirement | Acceptance Condition | Proof |
|---|---|---|
| Quorum integrity | M-of-N approvals with terminal immutability and unauthorized rejection | phase6 quorum unit tests |
| Delegation scope enforcement | Out-of-scope delegated actions fail closed | phase6 delegated authority tests |
| Policy inheritance safety | Child policy cannot broaden parent risk envelope | phase6 inheritance tests |
| Governance lineage integrity | Decision lineage chain exists and is append-only in exposed contract | phase6 lineage tests |
| Decision/lineage atomicity | Failed lineage append rolls back decision mutation (fail-closed) | governance transaction + integration atomicity tests |
| Governance error contract | Typed governance error categories with stable classifiable prefixes | phase6 governance test suite |
