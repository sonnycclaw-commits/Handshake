# AP6 Scheme of Work — Platform Accessibility, Identity Simplicity, and SDK Readiness

Status: Proposed (Atomic Execution Plan)
Date: 2026-03-01
Owner: Joel + Sonny

---

## 1) AP6 Mission

Make Handshake easy and safe to integrate by:
1. standardizing identity handling (Clerk-first, internal-principal canonical),
2. shipping contract-first SDK accessibility,
3. hardening trust boundaries for microservice growth,
4. keeping external experience simple while internal complexity remains hidden.

Design doctrine:
- Elegance in simplicity.
- Complexity absorbed internally.
- One obvious integration path.

Execution doctrine (mandatory):
- TDD/RED-first for every AP6 atomic unit.
- No implementation before failing RED suites and acceptance gates exist.
- Production readiness is defined first, then tested, then implemented.

---

## 2) Scope Boundaries

### In Scope
- Identity envelope standardization
- Route auth middleware/policy consistency for sensitive rails
- OpenAPI v1 for live rails
- TypeScript SDK (generated + ergonomic wrapper)
- Contract drift gates in CI
- Minimal microservice-ready trust-boundary conventions

### Out of Scope (AP6)
- Full microservice decomposition
- Multi-principal governance implementation (defer AP7+)
- Non-TS SDK parity beyond baseline Python scaffold

---

## 3) TDD-First Framework (AP6 Mandatory)

Every AP6 workstream follows this sequence:

1. **Define readiness criteria** (explicit go/no-go for the unit)
2. **Author RED suite first** (tests/spec checks that fail)
3. **Verify RED fails for expected reasons**
4. **Implement minimal GREEN changes**
5. **Refactor while preserving green**
6. **Run AP6 gates + record evidence**

No code implementation is permitted before step 2 is complete and failing.

---

## 4) Atomic Workstreams

## AP6-W1 — Identity Simplicity Contract

### Intent
One canonical identity context inside Handshake regardless of caller shape.

### Deliverables
1. `IdentityEnvelope` contract (internal):
   - principalId
   - subjectType
   - tenantId? (optional now)
   - roles/scopes
   - issuer/session metadata
2. Clerk-to-envelope adapter policy documented and test-enforced.
3. Sensitive routes consume envelope (not raw ad hoc headers/claims).

### Tasks
- AP6-W1.RED.1 Define W1 production-readiness criteria (identity determinism + fail-closed behavior)
- AP6-W1.RED.2 Author failing RED integration/unit suites for identity envelope + middleware behavior
- AP6-W1.RED.3 Verify RED suite fails for expected reasons
- AP6-W1.GREEN.1 Define envelope type + mapping rules
- AP6-W1.GREEN.2 Add shared auth middleware for protected rails
- AP6-W1.GREEN.3 Replace route-local auth parsing with middleware context
- AP6-W1.GREEN.4 Drive RED to GREEN and record gate evidence

### Success Criteria
- No protected endpoint directly parses provider claims in handler logic.
- Same caller identity yields deterministic authorization across rails.

---

## AP6-W2 — Trust Boundary Hardening (Microservice-ready)

### Intent
Prepare for service decomposition without identity spoofing or policy bypass.

### Deliverables
1. Internal trust contract:
   - where Clerk token is verified,
   - where only signed internal envelope is trusted.
2. Route class policy matrix:
   - public/read/protected/admin/governed-action.
3. Correlation ID propagation standard.

### Tasks
- AP6-W2.RED.1 Define W2 trust-boundary readiness criteria
- AP6-W2.RED.2 Author failing RED suites for spoofing, replay, and trust-boundary bypass
- AP6-W2.RED.3 Verify RED fails for expected reasons
- AP6-W2.GREEN.1 Define edge-vs-internal token verification policy
- AP6-W2.GREEN.2 Add signed internal context validation utilities (or fail-closed placeholder)
- AP6-W2.GREEN.3 Enforce artifact gate checks in privileged execution flow invariants
- AP6-W2.GREEN.4 Add replay/idempotency checks where missing in action/apply paths

### Success Criteria
- No privileged transition accepts unauthenticated/synthetic caller context.
- Internal call spoofing risks are reduced with explicit trust rails.

---

## AP6-W3 — Contract-First API Productization

### Intent
API contracts become first-class product surface, not implied by implementation.

### Deliverables
1. OpenAPI 3.1 contract for:
   - workflow
   - policy
   - metrics
   - agents
   - entities
2. Reason-code + response-class schema component.
3. API versioning baseline (`/v1` strategy or explicit version policy in contract docs).

### Tasks
- AP6-W3.RED.1 Define W3 contract completeness criteria
- AP6-W3.RED.2 Author failing RED contract/parity checks (runtime vs spec)
- AP6-W3.RED.3 Verify RED fails for expected reasons
- AP6-W3.GREEN.1 Create `openapi/handshake.v1.yaml`
- AP6-W3.GREEN.2 Wire schema parity tests (spec vs runtime payloads)
- AP6-W3.GREEN.3 Add contract lint/validation in CI
- AP6-W3.GREEN.4 Update reference docs to point at OpenAPI as source of truth

### Success Criteria
- Spec is machine-valid and CI-gated.
- Runtime payloads in integration tests conform to OpenAPI schemas.

---

## AP6-W4 — SDK Accessibility (TS First)

### Intent
Integrators get one clean developer experience path.

### Deliverables
1. Generated TS SDK from OpenAPI.
2. Ergonomic wrapper package:
   - `workflow.submitRequest()`
   - `workflow.resolveAction()`
   - `policy.simulate()/apply()`
   - `agents.list()/get()`
   - `entities.list()/get()`
3. Error normalization in SDK:
   - reasonCode
   - responseClass
   - retryability hint

### Tasks
- AP6-W4.RED.1 Define W4 SDK usability criteria (<15 min first governed action)
- AP6-W4.RED.2 Author failing SDK integration/smoke tests
- AP6-W4.RED.3 Verify RED fails for expected reasons
- AP6-W4.GREEN.1 Generate baseline TS client from OpenAPI
- AP6-W4.GREEN.2 Add wrapper layer with simplified methods
- AP6-W4.GREEN.3 Add auth injector + retry policy config
- AP6-W4.GREEN.4 Add integration examples and smoke tests

### Success Criteria
- New integrator can execute first governed request in <15 minutes.
- No manual request-shape assembly required for common flows.

---

## AP6-W5 — CI/Operational Gates

### Intent
Prevent drift and regressions automatically.

### Deliverables
1. AP6 gate command(s) in package scripts.
2. CI checks for:
   - typecheck
   - prod-gate tests
   - OpenAPI validity
   - SDK generation drift

### Tasks
- AP6-W5.RED.1 Define W5 release-gate criteria
- AP6-W5.RED.2 Author failing gate checks for drift and readiness
- AP6-W5.RED.3 Verify RED fails for expected reasons
- AP6-W5.GREEN.1 Add `test:ap6-gate` script
- AP6-W5.GREEN.2 Add `check:openapi` and `check:sdk-drift`
- AP6-W5.GREEN.3 CI wiring in GitHub Actions
- AP6-W5.GREEN.4 failure playbook notes in docs

### Success Criteria
- PR cannot merge when contract/spec/sdk drift exists.
- One-command readiness gate available locally and in CI.

---

## 5) Core Docs and Task Files to Touch

1. `docs/workflow/DECISION-REGISTER.md`
   - Add AP6 decision: identity-envelope + SDK-first contract path
2. `docs/workflow/REQUEST-TDD-SPEC.md`
   - Add AP6 identity boundary + contract-governance clauses
3. `docs/reference/API.md`
   - Convert to OpenAPI-pointer-first documentation
4. `TASKS.md` (backend canonical)
   - Add AP6 queue with atomic checkboxes
5. `package.json`
   - Add AP6 gate scripts
6. `docs/workflow/AP6-SCHEME-OF-WORK.md`
   - this file (execution baseline)

Optional (if creating SDK package now):
7. `sdk/` (generated + wrapper)
8. `openapi/handshake.v1.yaml`

---

## 6) Patterns / Anti-Patterns

## Patterns (Do)
- Contract-first development (spec drives SDK + tests).
- Middleware-enforced auth context.
- Fail-closed on unknown identity/claims/reason codes.
- Versioned reason-code taxonomy stability.
- Generated client + ergonomic facade (both, not either/or).

## Anti-Patterns (Avoid)
- Route-level ad hoc Clerk parsing.
- Handwritten SDK as primary source of truth.
- Unversioned breaking payload changes.
- “Tests pass” without `tsc` and contract checks.
- Exposing internal complexity through API ergonomics.

---

## 7) How We Know AP6 Succeeded

AP6 is successful when all are true:

1. Identity is simple externally and uniform internally.
2. OpenAPI is authoritative and CI-enforced.
3. TS SDK exists and is usable for core flows quickly.
4. Protected routes are middleware-governed with deterministic auth behavior.
5. Drift between runtime/spec/sdk is blocked by CI.

Operational acceptance signals:
- 0 critical auth-context mismatches in integration suites.
- 0 contract mismatch regressions across AP6 gates.
- Integrator setup path documented and verified end-to-end.

---

## 8) Execution Order (Atomic)

1. W1 Identity Simplicity
2. W2 Trust Boundary Hardening
3. W3 OpenAPI Productization
4. W4 SDK Accessibility
5. W5 CI Gates + rollout checks

No parallelization until W1+W2 are stable (security foundation first).

---

## 9) Handover / Sleep Protocol (post-run)

At end of AP6 execution session:
1. Update `TASKS.md` AP6 status + blocked items
2. Update decision register with AP6 architecture choices
3. Record gate outcomes (`typecheck`, `test:prod-gate`, `test:ap6-gate`)
4. Run `clawvault sleep` with:
   - summary
   - next steps
   - blockers/decisions needed

This ensures continuity without context loss.
