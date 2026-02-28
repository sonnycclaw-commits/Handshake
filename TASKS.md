# Handshake Tasks (Canonical)

## Current Build Status

### Phase 3.5
- [x] TDD spec + RED suites written
- [x] Implementation baseline complete
- [x] Full suite green gate passed

### Phase 4
- [x] `docs/PHASE4-TDD-SPEC.md`
- [x] RED suites authored
- [x] P4-U1 operator read model implemented
- [x] P4-U2 policy management implemented
- [x] P4-U3 HITL queue visibility implemented
- [x] P4 regression gate passed

### Phase 5
- [x] `docs/PHASE5-TDD-SPEC.md` (transparent trust posture direction)
- [x] RED suites authored
- [x] P5-U1 trust posture service implemented
- [x] P5-U2 risk signal aggregation implemented
- [x] P5-U3 incident report implemented
- [x] P5-U4 emergency controls implemented
- [x] P5 regression gate passed

### Phase 6
- [x] `docs/PHASE6-TDD-SPEC.md`
- [x] RED suites authored
- [x] P6-U1 quorum HITL implemented
- [x] P6-U2 delegated authority implemented
- [x] P6-U3 policy inheritance implemented
- [x] P6-U4 governance audit lineage implemented
- [x] R2 quorum persistence abstraction complete
- [x] R3 lineage persistence abstraction complete
- [x] R4 governance transaction boundary + rollback complete
- [x] Canonical governance write path established (`submitGovernanceDecision`)
- [x] Runtime determinism hooks added to governance services (clock/id injection where required)
- [x] Typed governance error rail implemented
- [x] Governance atomicity integration suite added
- [x] P6 regression gate passed

## Gate Evidence (latest)

- `npm test -- tests/unit/phase4 tests/unit/phase5 tests/unit/phase6` ✅
- `npm test -- tests/integration` ✅
- `npm test` ✅

Current full-suite baseline: **94/94 test files, 446/446 tests passing**

## Next Queue (Layer 4/5 Hardening)

1. [ ] Durable persisted adapters for quorum + lineage stores
2. [ ] Brute-force resilience and response-class normalization controls
3. [ ] Expanded adversarial and operational chaos suites


## Onboarding Backend Queue (TDD-First, FE Out of Scope)

Source: `docs/onboarding-foundation/TASKS-ONBOARDING-BE.md`

### Guardrails
- [ ] No frontend/UI implementation in this queue
- [ ] No new Clerk dependency in core onboarding path (deferred integration)
- [ ] Every implementation task maps to T-ONB scenario IDs
- [ ] Fail-closed semantics preserved across onboarding flows

### OBE-1 — Spec + Contract Lock
- [x] OBE-1.1 WF-00 PRD integration
- [x] OBE-1.2 PRD traceability mapping (`T-ONB-001..014`)
- [x] OBE-1.3 ADR onboarding promotion prep

### OBE-2 — RED Test Authoring
- [x] OBE-2.1 RED tests for `T-ONB-001..010`
- [x] OBE-2.2 RED tests for `T-ONB-011..014`
- [x] OBE-2.3 Contract stability RED (policy envelope + deterministic outcomes)

### OBE-3 — Minimal GREEN Implementation (Backend)
- [x] OBE-3.1 Onboarding state machine service
- [x] OBE-3.2 Decision outcome + reason rail
- [x] OBE-3.3 Revoke test path
- [x] OBE-3.4 Non-bypass enforcement check
- [x] OBE-3.5 Audit event contract

### OBE-4 — Reliability + Gate
- [x] OBE-4.1 Timeout/fail-closed hardening
- [x] OBE-4.2 TTFTP telemetry instrumentation (p95)
- [x] OBE-4.3 Regression gate (onboarding + integration + full suite)


Last updated: 2026-02-28 UTC


## WF-05 Request Workflow Hardening Queue

- [ ] WF5-H1 Decision artifact gate enforced at privileged execution boundary
- [x] WF5-H2 Reason-code taxonomy lock (versioned registry + drift guard)
- [ ] WF5-H3 Escalation precision controls (flood guard + budget telemetry)
- [x] WF5-H4 Cross-surface parity gate in CI (API/chat/workflow)
- [ ] WF5-H5 Retry-policy contract enforcement in agent runtime integration tests
- [ ] WF5-H6 Full WF-05 regression gate integrated into main suite


## Hexagonal Refactor Program (Pass-based)

### Pass 1 — Architecture Map
- [x] P1-M1 Write Hexagonal Standard v1 into `ARCHITECTURE.md`
- [x] P1-M2 Generate full file map with status (`PASS|DRIFT|VIOLATION`)

### Pass 2 — Critical Priority (Violations)
- [x] P2-C1 Remove adapter imports from `domain/services/hitl-workflow.ts` (inject via port/use-case)
- [x] P2-C2 Remove adapter imports from `domain/services/request-workflow.ts` (inject via port/use-case)
- [x] P2-C3 Add CI guard: fail build on `domain -> adapters` imports

### Pass 3 — High Priority (Drift)
- [x] P3-H5 Extract HITL resolution branches (approve/reject/timeout) from `request-workflow.ts` into dedicated module with parity tests
- [x] P3-H4 Decompose `request-workflow.ts` into focused modules (types/context/validation/escalation/persistence/store extracted) while preserving behavior parity
- [ ] P3-H1 Move WF5 ops metrics projection out of domain into projector/use-case layer
- [ ] P3-H2 Decouple governance transaction lineage side-effects from domain service (event + projection pattern)
- [ ] P3-H3 Reduce `index.ts` business semantics to transport/wiring only

### Pass 4 — Medium Priority
- [ ] P4-M1 Converge onboarding workflow semantics onto WF5 canonical reason/state contracts
- [ ] P4-M2 Introduce architecture lint for single-purpose file scope thresholds
- [ ] P4-M3 Add sunset tasks for remaining compatibility fallback paths
