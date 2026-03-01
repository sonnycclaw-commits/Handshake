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

## WF-05/OPS Transport Completion Queue (Production Readiness)

### Principle
Production readiness = endpoint transport + invariant preservation + FE/BE contract parity.

### WF5-API-01 — Workflow Rail Exposure
- [x] WF5-API-01.1 Add `POST /workflow/requests` (submit canonical request)
- [x] WF5-API-01.2 Add `GET /workflow/requests/:requestId` (persisted state + artifact)
- [x] WF5-API-01.3 Add `GET /workflow/decision-room/:requestId` (operator decision context payload)
- [x] WF5-API-01.4 Add `POST /workflow/decision-room/action` (canonical actions `approve|reject`)
- [x] WF5-API-01.5 Add `GET /workflow/evidence/:requestId` (ordered audit + lineage timeline)

### WF5-API-02 — Invariant Enforcement at Endpoint Boundary
- [x] WF5-API-02.1 Enforce fail-closed validation at request submit boundary
- [x] WF5-API-02.2 Enforce terminal-state immutability via action endpoint
- [x] WF5-API-02.3 Enforce decision artifact semantics on privileged continuation path
- [x] WF5-API-02.4 Structured reason-code responses for all non-2xx outcomes

### WF5-API-03 — Policy Rail Exposure (Versioned Governance)
- [x] WF5-API-03.1 Add `GET /policy/config`
- [x] WF5-API-03.2 Add `POST /policy/simulate`
- [x] WF5-API-03.3 Add `POST /policy/apply`
- [x] WF5-API-03.4 Persist policy version and return traceable version id in apply response
- [x] WF5-API-03.5 Emit audit linkage for apply operations

### WF5-API-04 — Operator Read Rails
- [x] WF5-API-04.1 Add `GET /agents`
- [x] WF5-API-04.2 Add `GET /agents/:agentId`
- [x] WF5-API-04.3 Entities rail decision gate: approve explicit entity domain + storage contract before endpoint release

### WF5-API-05 — Contract + Parity Gates
- [x] WF5-API-05.1 Lock transport contracts in tests for workflow/policy/agents rails
- [x] WF5-API-05.2 Add FE/BE parity test for decision-room action semantics (`approve|reject`)
- [x] WF5-API-05.3 Add integration tests for evidence timeline ordering/completeness
- [x] WF5-API-05.4 Add production gate command that validates contract + invariants + parity



WF5-API-05.4 note: Dedicated production gate command is `npm run test:prod-gate`.


Hardening notes (post-sniff-test):
- Decision approve path now requires Authorization: Bearer principal:<ownerId> and enforces approver authorization.
- Error envelope compatibility preserved with both `error` and `reasonCode` fields.
- FE action semantic guard enforced: `escalate` is rejected at decision action endpoint (400).
- Production gate command added: `npm run test:prod-gate`.


WF5-API-04 note: Agents + Entities read rails implemented. Entity model is now unlocked with approved type-agnostic contract.


Entity model note: Implemented as type-agnostic (`entity_type` string) to preserve platform agility and avoid lock-in.

## AP6 — Platform Accessibility + Identity Simplicity (Atomic, TDD-First)

AP6 rule: **No implementation before RED suites are authored and failing for expected reasons.**

### AP6-W1 Identity Simplicity Contract
- [ ] AP6-W1.RED.1 Define W1 production-readiness criteria
- [x] AP6-W1.RED.2 Author RED suites for identity envelope + middleware
- [x] AP6-W1.RED.3 Verify RED fails for expected reasons
- [x] AP6-W1.GREEN.1 Define canonical IdentityEnvelope type and claim mapping policy
- [x] AP6-W1.GREEN.2 Add shared auth middleware for protected rails
- [x] AP6-W1.GREEN.3 Remove route-level ad hoc provider claim parsing in protected handlers
- [x] AP6-W1.GREEN.4 Drive RED to GREEN and capture gate evidence

### AP6-W2 Trust Boundary Hardening
- [x] AP6-W2.RED.1 Define W2 trust-boundary readiness criteria
- [x] AP6-W2.RED.2 Author RED suites for spoofing/replay/bypass
- [x] AP6-W2.RED.3 Verify RED fails for expected reasons
- [x] AP6-W2.GREEN.1 Define edge-vs-internal token trust policy (doc + enforcement)
- [x] AP6-W2.GREEN.2 Add internal context trust validation utility (signed header or fail-closed placeholder)
- [x] AP6-W2.GREEN.3 Verify artifact gate enforcement path parity under middleware auth
- [x] AP6-W2.GREEN.4 Add idempotency/replay hardening checks for action/apply rails

### AP6-W3 Contract-First Productization
- [x] AP6-W3.RED.1 Define W3 contract completeness criteria
- [x] AP6-W3.RED.2 Author RED contract/parity checks (runtime vs spec)
- [x] AP6-W3.RED.3 Verify RED fails for expected reasons
- [x] AP6-W3.GREEN.1 Create `openapi/handshake.v1.yaml`
- [x] AP6-W3.GREEN.2 Add OpenAPI validation gate (`check:openapi`)
- [x] AP6-W3.GREEN.3 Add runtime-vs-spec parity tests for core endpoints
- [x] AP6-W3.GREEN.4 Align docs/reference/API.md to OpenAPI-first model

### AP6-W4 SDK Accessibility
- [x] AP6-W4.RED.1 Define W4 SDK usability criteria (<15 min first governed action)
- [x] AP6-W4.RED.2 Author RED SDK integration/smoke tests
- [x] AP6-W4.RED.3 Verify RED fails for expected reasons
- [x] AP6-W4.GREEN.1 Generate TypeScript SDK from OpenAPI
- [x] AP6-W4.GREEN.2 Add ergonomic wrapper for workflow/policy/agents/entities
- [x] AP6-W4.GREEN.3 Add SDK auth injection + retryability/error normalization helper
- [x] AP6-W4.GREEN.4 Drive RED to GREEN + quickstart smoke evidence

### AP6-W5 CI + Release Gates
- [x] AP6-W5.RED.1 Define AP6 go/no-go gate criteria
- [x] AP6-W5.RED.2 Author failing gate checks for drift/readiness
- [x] AP6-W5.RED.3 Verify RED fails for expected reasons
- [x] AP6-W5.GREEN.1 Add `test:ap6-gate` script
- [x] AP6-W5.GREEN.2 Add `check:sdk-drift` script
- [x] AP6-W5.GREEN.3 Wire CI gate for typecheck + prod-gate + openapi + sdk-drift
- [x] AP6-W5.GREEN.4 Add AP6 go/no-go release checklist execution proof



AP6 RED evidence (2026-03-01): `npm test -- tests/red/ap6/*.test.ts` => 5 failed files / 15 failed tests (expected RED).


AP6 RED smell pass (2026-03-01): Removed brittle source-string assertion from W1 RED suite; normalized W3 missing-spec failures to explicit assertions (no ENOENT noise). RED remains 5 files / 15 tests failing by design.


P3-H3 structural refactor progress (2026-03-01): Extracted modular route/app/core scaffolding and reduced `src/index.ts` to thin bootstrap while preserving existing integration behavior (workflow/policy/agents/entities/metrics suites still green).

AP6 W1/W2 green evidence (2026-03-01, updated):
- Identity envelope middleware added and enforced on decision-action + policy-apply protected paths.
- Replay guard added via `x-idempotency-key` + KV fail-closed check.
- Structural refactor completed: index.ts thin bootstrap; modular route/core/app layout.
- Verification:
  - `npx tsc --noEmit` ✅
  - W1/W2 RED suites ✅
  - Existing integration transport suites ✅
  - Remaining RED failures are W3/W4/W5 by design (OpenAPI/SDK/CI gates pending).



AP6 semantic hardening evidence (2026-03-01):
- Added semantic OpenAPI validator (`scripts/check-openapi.mjs`) with YAML parse + path/method/ref resolution checks.
- Added semantic SDK drift validator (`scripts/check-sdk-drift.mjs`) with spec-to-wrapper surface mapping checks.
- Added AP6 gate artifact output (`artifacts/ap6-gate-report.json`) from `scripts/test-ap6-gate.mjs`.
- Added runtime contract parity fixtures (`tests/integration/workflow/ap6-openapi-runtime-parity.test.ts`).
- Added SDK smoke in CI (`npm run test:sdk-smoke`) and vitest include for `sdk/**/*.test.ts`.
- Verification:
  - `npm run test:ap6-gate` ✅
  - `npm run test:sdk-smoke` ✅
  - `npm run check:openapi` ✅
  - `npm run check:sdk-drift` ✅
  - `npm run test:prod-gate` ✅
  - `npx tsc --noEmit` ✅
  - `npm test` ✅


AP6 W2 hardening evidence (2026-03-01):
- Introduced signed internal trust middleware (`src/middleware/internal-trust-context.ts`) with HS256 verification, typed claim checks, TTL/skew validation, and fail-closed behavior.
- Added explicit internal trust reason codes:
  - `security_invalid_internal_trust_context`
  - `security_internal_trust_context_expired`
  - `security_internal_trust_config_missing`
- Enforced internal trust middleware on `/policy/apply` (in addition to identity envelope).
- Added unit/integration RED coverage for malformed, invalid-signature, expired, and valid signed trust context tokens.
- Added env binding for shared trust secret (`INTERNAL_TRUST_SHARED_SECRET`) and internal trust context variable wiring.
- Verification:
  - `npm test -- tests/red/ap6/trust-boundary.ap6.red.test.ts` ✅
  - `npm test -- tests/integration/workflow/policy-transport.phase-api.test.ts` ✅
  - `npm run test:ap6-gate` ✅
  - `npm run test:prod-gate` ✅
  - `npx tsc --noEmit` ✅


AP6 W3 hardening evidence (2026-03-01):
- Hardened OpenAPI contract to remove responseClass ambiguity:
  - introduced canonical `components.schemas.ResponseClass` = `ok|retryable|blocked|unknown`
  - ref-wired `ErrorResponse`, `WorkflowArtifact`, and `AuthorizeExecutionResult` to canonical ResponseClass schema
- Added explicit operation-level security in OpenAPI:
  - `POST /workflow/decision-room/action` requires `IdentityEnvelopeHeader`
  - `POST /policy/apply` requires both `IdentityEnvelopeHeader` + `InternalTrustContextHeader`
  - documented `x-idempotency-key` header for decision action replay guard
- Upgraded OpenAPI gate to standards-level schema validation:
  - integrated `@apidevtools/swagger-parser` validation in `scripts/check-openapi.mjs`
  - kept semantic guard checks (required rails, refs, security requirements)
- Tightened runtime parity suite for contract semantics:
  - aligned responseClass sample values to canonical enum
  - added runtime `toResponseClass` compatibility assertion
- API docs now aligned as OpenAPI-first canonical pointer (`docs/reference/API.md`).
- Verification:
  - `npm run check:openapi` ✅
  - `npm run check:sdk-drift` ✅
  - `npx vitest run tests/integration/workflow/ap6-openapi-runtime-parity.test.ts tests/red/ap6/openapi-parity.ap6.red.test.ts` ✅
  - `npm run test:ap6-gate` ✅
  - `npm run test:prod-gate` ✅
  - `npx tsc --noEmit` ✅


AP6 W4 hardening evidence (2026-03-01):
- Added deterministic SDK code generation pipeline from OpenAPI:
  - tool: `@hey-api/openapi-ts`
  - command: `npm run sdk:generate`
  - output: `sdk/typescript/generated/*`
- Added generation config + script:
  - `sdk/typescript/openapi-ts.config.ts`
  - `scripts/generate-sdk.mjs`
- Upgraded SDK drift gates to enforce generated surface + canonical response semantics:
  - verifies generated files exist
  - verifies generated ops (`submitWorkflowRequest`, `resolveDecisionAction`, `applyPolicy`, etc.)
  - verifies generated canonical `ResponseClass = ok|retryable|blocked|unknown`
- Hardened ergonomic wrapper (`sdk/typescript/src/handshake-client.ts`) to compose generated client ops with safe guardrails:
  - `workflow.resolveAction` enforces identity envelope header + optional idempotency key
  - `policy.apply` enforces identity envelope + internal trust token provider/value
- Fixed SDK error normalization drift:
  - `sdk/typescript/src/errors.ts` now aligned to canonical response classes (`ok|retryable|blocked|unknown`)
- Expanded SDK smoke harness to validate:
  - wrapper method availability
  - protected header injection for decision/apply flows
  - normalized error contract and retryability semantics
- Verification:
  - `npm run sdk:generate` ✅
  - `npm run sdk:check-generated` ✅
  - `npm run check:sdk-drift` ✅
  - `npm test -- tests/red/ap6/sdk-accessibility.ap6.red.test.ts` ✅
  - `npm run test:sdk-smoke` ✅
  - `npm run test:ap6-gate` ✅
  - `npm run test:prod-gate` ✅
  - `npx tsc --noEmit` ✅


AP6 W5 hardening evidence (2026-03-01):
- Added deterministic AP6 report verification gate:
  - `scripts/verify-ap6-gate-report.mjs`
  - validates `artifacts/ap6-gate-report.json` integrity, required check labels, pass statuses, and zero exit codes
- Strengthened AP6 gate pipeline ordering and completeness (`scripts/test-ap6-gate.mjs`):
  - includes SDK generation + generated artifact check + SDK smoke + typecheck in the AP6 gate itself
- Added CI enforcement step for AP6 gate artifact validity:
  - `.github/workflows/ci.yml` now runs `npm run check:ap6-report` after `test:ap6-gate`
- Tightened contract strictness rails in OpenAPI gate:
  - enforce `additionalProperties: false` on strict envelope/result schemas
  - fail if strict schemas are permissive
- Added strict schema declarations in OpenAPI for core envelopes/results:
  - `ErrorResponse`, `WorkflowArtifact`, `DecisionActionResult`, `AuthorizeExecutionResult`, `PolicyApplyResult`
- Verification:
  - `npm run check:openapi` ✅
  - `npm run test:ap6-gate` ✅
  - `npm run check:ap6-report` ✅
  - `npm run test:prod-gate` ✅
  - `npm run test:sdk-smoke` ✅
  - `npx tsc --noEmit` ✅

## 30-Day $1Bn Scale Program (Execution Tracker)

### Cross-Cutting Controls (apply to all weeks)
- [x] XCT-1 One-slice commits only (no blended refactors)
- [x] XCT-2 No gate bypasses
- [x] XCT-3 Docs/runtime/tests updated in same change set
- [x] XCT-4 Every security behavior change has RED->GREEN evidence
- [x] XCT-5 Decision register updated for each architectural decision

---

### Week 1 — Transitional Risk Surface Elimination

- [x] W1-A1 Decide legacy bridge fate (`request-workflow-api.ts`) with owner + deprecation path
- [x] W1-A2 CI import-boundary enforcement for legacy workflow APIs
- [x] W1-A3 Migrate all straggler callsites to explicit service factory path
- [x] W1-A4 Add deprecation metadata (owner, expiry date, replacement path)

**Acceptance checks:**
- [x] W1-AC1 Zero legacy imports in production src
- [x] W1-AC2 Boundary checks enforced in CI
- [x] W1-AC3 Full gates green after migration

---

### Week 2 — Least-Privilege Scope Model

- [ ] W2-B1 Define/enforce scope hierarchy: `workflow:read:self|tenant|any`
- [ ] W2-B2 Upgrade read authz decision table (self/tenant/any + tenant guard)
- [ ] W2-B3 Add backward-compat mode + explicit sunset for old broad scope behavior
- [ ] W2-B4 Update OpenAPI + CONTRACT/INTEGRATION/WORKFLOWS docs in same change set
- [ ] W2-B5 Add full matrix tests for scope + tenant combinations

**Acceptance checks:**
- [ ] W2-AC1 Scope semantics deterministic and test-covered
- [ ] W2-AC2 Cross-principal read ambiguity removed
- [ ] W2-AC3 Backward-compat behavior explicit and time-bounded

---

### Week 3 — Production Observability & Alerts

- [ ] W3-C1 Emit structured telemetry for key denial/replay failures
- [ ] W3-C2 Build baseline dashboards (reason trend, endpoint failure, replay events)
- [ ] W3-C3 Configure alerts for replay guard unavailable, denial spikes, tenant mismatch spikes
- [ ] W3-C4 Link each alert to runbook actions in OPERATIONS

**Acceptance checks:**
- [ ] W3-AC1 Critical authz/replay failures are observable in real time
- [ ] W3-AC2 Alerts route correctly in staging simulation
- [ ] W3-AC3 Operators can resolve without source-code deep dive

---

### Week 4 — Release Discipline & Environment Safety

- [ ] W4-D1 Migration confirmation gate in deploy path
- [ ] W4-D2 Enforce environment matrix (no prod with dev bypass flags)
- [ ] W4-D3 Add invariant/property tests:
  - [ ] scope lattice monotonicity
  - [ ] tenant isolation invariants
  - [ ] deterministic reason/status for equivalent failures
- [ ] W4-D4 Automate release checklist proof (contract parity, map completeness, no legacy imports, schema preflight, full gates)
- [ ] W4-D5 24h post-release verification watch with explicit thresholds

**Acceptance checks:**
- [ ] W4-AC1 Pipeline enforces migration + policy integrity
- [ ] W4-AC2 Invariant/property tests protect against semantic drift
- [ ] W4-AC3 No manual “trust me” release path remains

---

## Day-30 Go/No-Go Criteria

### Go only if all are true:
- [ ] deterministic reason/status contract enforced in CI
- [ ] least-privilege scope model active
- [ ] tenant/read isolation tested and monitored
- [ ] no legacy hidden path in production code
- [ ] migration preflight blocks unsafe deploys
- [ ] runbooks + alerts operational

### Deliverables target by Day 30
- [ ] Legacy surface minimized or removed
- [ ] Scope hierarchy operational + enforced
- [ ] Production telemetry + alerts live
- [ ] Migration-safe release pipeline active
- [ ] Deterministic behavior proven by invariant tests
- [ ] Canonical docs updated with no integrator/operator ambiguity
