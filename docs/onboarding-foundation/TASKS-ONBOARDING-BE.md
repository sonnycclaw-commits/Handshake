# Onboarding Backend Tasks (Atomic, TDD-First)

Status: Complete (OBE closeout)
Scope: **Backend only** (no FE work)
Source: `ONBOARDING-DESIGN-STANDARD.md`, `ONBOARDING-TDD-SCENARIOS.md`, `docs/PRD.md`

---

## Guardrails

- [x] No frontend/UI implementation in this task set
- [x] No new Clerk dependency in core onboarding path (deferred integration)
- [x] Every implementation task maps to TDD scenario IDs
- [x] Fail-closed semantics preserved across all flows

---

## Sprint OBE-1 — Spec + Contract Lock

### OBE-1.1 WF-00 PRD Integration
- [x] Add WF-00 onboarding contract to `docs/PRD.md`
- [x] Add flow-level acceptance matrix row for WF-00
- [x] Link to onboarding foundation docs
- **Done when:** PRD contains canonical WF-00 contract language

### OBE-1.2 Traceability Mapping
- [x] Map `T-ONB-001..014` into `docs/PRD-TRACEABILITY.md`
- [x] Ensure each onboarding principle has >=1 test mapping
- **Done when:** full bidirectional mapping exists (Principle -> Test -> PRD)

### OBE-1.3 ADR Promotion Prep
- [x] Move ADR-ONBOARDING-0001 to approved-ready state (still proposal until sign-off)
- [x] Add consequences + acceptance checks aligned with WF-00
- **Done when:** ADR is promotion-ready with no unresolved placeholders

---

## Sprint OBE-2 — RED Test Authoring (Backend)

### OBE-2.1 Core Onboarding Flow RED
- [x] Author RED tests for T-ONB-001..010
- [x] Include deterministic fixtures and reason-code assertions
- **Done when:** new onboarding baseline suite fails for expected reasons only

### OBE-2.2 Hardening Flow RED
- [x] Author RED tests for T-ONB-011..014
- [x] Include adversarial bypass attempt + revoke-under-pressure + export-grade audit checks
- **Done when:** hardening suite fails for expected reasons only

### OBE-2.3 Contract Stability RED
- [x] Add schema/contract tests for machine-readable policy envelope
- [x] Add outcome class stability tests (`allow|deny|escalate`) across supported backend paths
- **Done when:** contract tests fail on current non-implemented/misaligned behavior

---

## Sprint OBE-3 — Minimal GREEN Implementation (Backend)

### OBE-3.1 Onboarding State Machine Service
- [x] Implement backend state transitions for onboarding lifecycle
- [x] Enforce invalid transition rejection
- **Done when:** T-ONB state-path tests green

### OBE-3.2 Decision Outcome + Reason Rail
- [x] Implement standardized reason codes for onboarding decisions
- [x] Enforce presence of reason code on all outcomes
- **Done when:** T-ONB-007 green

### OBE-3.3 Revoke Test Path
- [x] Implement revoke/pause test endpoint/service behavior for onboarding context
- [x] Ensure post-revoke privileged action deny semantics
- **Done when:** T-ONB-004, T-ONB-012 green

### OBE-3.4 Non-Bypass Enforcement Check
- [x] Enforce privileged action rejection without handshake path requirements
- [x] Emit security audit event on bypass attempt
- **Done when:** T-ONB-005, T-ONB-011 green

### OBE-3.5 Audit Event Contract
- [x] Implement mandatory onboarding event logging payloads
- [x] Ensure decision-grade fields and lineage identifiers present
- **Done when:** T-ONB-008, T-ONB-013 green

---

## Sprint OBE-4 — Reliability + Gate

### OBE-4.1 Timeout/Fail-Closed Hardening
- [x] Validate HITL timeout -> deny path in onboarding context
- [x] Ensure no implicit allow paths remain
- **Done when:** T-ONB-003 green under race/timeout tests

### OBE-4.2 TTFTP Telemetry Instrumentation
- [x] Implement backend timing instrumentation for TTFTP (event timestamps)
- [x] Expose metric query path for p95 checks
- **Done when:** T-ONB-010 measurable in test harness

### OBE-4.3 Regression Gate
- [x] Run onboarding suite + integration suite + full regression
- [x] Capture evidence summary in onboarding foundation folder
- **Done when:** all onboarding tests green, no regressions introduced

---

## Out of Scope (Explicit)

- Frontend screens/components
- Visual dashboard work
- Clerk-first onboarding dependency chain (legacy MVP path)

---

## Notes

- Clerk can be reintroduced later as an adapter/integration path, not as onboarding critical path.
- This task list is intentionally atomic and backend-enforceable.
