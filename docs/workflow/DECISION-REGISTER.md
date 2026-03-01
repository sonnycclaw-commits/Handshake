# Decision Register

## DR-2026-02-28-001 — Identity Provider Direction: Clerk (Reaffirmed)

- **Status:** Approved
- **Date:** 2026-02-28
- **Owner:** Joel + Sonny

### Decision
Handshake identity path is **Clerk-first**. We will cut over from direct provider OAuth handling (Google/GitHub exchange in backend) to Clerk-verified identity claims as the primary identity boundary.

### Context
Original intent was Clerk-based identity. During production readiness work, implementation focus drifted into direct provider OAuth completion. This decision explicitly corrects course and restores the intended architecture.

### Why
- Simpler identity surface
- Lower security and maintenance burden
- Cleaner separation of concerns: Clerk handles auth/federation, Handshake handles trust/policy/audit

### Execution Constraint
AP6 will execute in strict TDD mode: RED suites first, implementation second, gate evidence required.

### Scope Impact
**In:**
- Clerk token/session verification adapter
- Claim-to-principal mapping contract
- Feature-flagged cutover (`IDENTITY_PROVIDER=clerk|legacy`)

**Out:**
- Expanding direct provider OAuth as long-term path

### Operational Note
Legacy OAuth endpoints remain only as temporary compatibility paths during migration, then are decommissioned.

### Next Actions
1. Define Clerk claim contract consumed by Handshake
2. Implement Clerk identity adapter behind feature flag
3. Run parity tests on trust/policy/audit behavior
4. Cut over production to Clerk mode and monitor

## DR-2026-02-28-002 — Production Readiness = Contracted Workflow Transport + Invariants

- **Status:** Approved (working baseline)
- **Date:** 2026-02-28
- **Owner:** Joel + Sonny

### Decision
Production readiness is not defined by endpoint count. It is defined by:
1. transport exposure of canonical workflow contracts,
2. preservation of workflow invariants,
3. FE/BE contract parity under test.

### What the application must do
1. Accept privileged requests through one canonical decision rail.
2. Resolve each request deterministically to `allow|deny|escalate`.
3. Enforce artifact-gated privileged execution (no bypass).
4. Expose operator decision context and actionable evidence.
5. Provide trust/ops metrics and reason-family visibility.
6. Support policy simulation and activation with version traceability.

### Endpoint Intent (production target)
- **Workflow rail:** request submit/read, decision-room context, HITL action resolution, evidence replay.
- **Policy rail:** get config, simulate impact, apply versioned policy.
- **Metrics rail:** summary/series/reasons/project (already live).
- **Operator rails:** agents read APIs in-scope; entities read APIs require explicit domain model confirmation before release.

### Guardrails
- No FE hookup to unversioned/unstable contracts.
- No endpoint that bypasses terminal-state immutability, fail-closed behavior, or decision-context integrity.
- No entity API release without approved entity model + storage contract.

### Acceptance Gate
A rail is production-ready only when contract tests + integration tests + parity tests are green and invariants are preserved at endpoint boundary.

## DR-2026-03-01-003 — AP6 Architecture Direction: Identity Envelope + Contract-First SDK

- **Status:** Approved
- **Date:** 2026-03-01
- **Owner:** Joel + Sonny

### Decision
AP6 will optimize for integration elegance by adopting:
1. Canonical internal identity envelope (Clerk-first at edge, provider-agnostic in core),
2. OpenAPI-as-source-of-truth contract governance,
3. TypeScript SDK-first external accessibility,
4. CI drift gates for runtime/spec/sdk parity.

### Why
- Simplicity for integrators requires complexity absorption in backend architecture.
- Current backend transport completeness must now be converted into platform-grade developer experience.
- Security and workflow determinism require consistent identity context and contract discipline.

### Execution Constraint
AP6 will execute in strict TDD mode: RED suites first, implementation second, gate evidence required.

### Scope Impact
**In:**
- AP6 identity middleware + envelope contract
- OpenAPI v1 and schema parity gates
- TS SDK generation + ergonomic wrapper
- CI checks for spec + SDK drift

**Out (deferred):**
- Full microservice decomposition
- Multi-principal governance model implementation

### Acceptance
AP6 is considered complete only when identity handling, contract validity, SDK usability, and CI drift controls are all green under defined gates.


## DR-2026-03-01-004 — AP6 Polish: Integrator-Grade Contract Parity + Compatibility Rails

- **Status:** Approved
- **Date:** 2026-03-01
- **Owner:** Joel + Sonny

### Decision
Handshake AP6 polish formalizes the external builder contract by enforcing parity across runtime, OpenAPI, and SDK, and by adding explicit compatibility policy/docs as first-class artifacts.

### Why
AP6 core hardening delivered security and modularity, but integrator ergonomics required explicit closure:
- protected read routes needed contract-level security annotation parity,
- SDK protected-read methods needed identity envelope support,
- compatibility expectations needed to be documented for a moving platform.

### Core Changes
1. OpenAPI security annotations added for protected workflow read/evidence endpoints.
2. TypeScript SDK wrapper updated so protected workflow reads require identity envelope (same model as decision actions).
3. Integrator-facing docs added:
   - `README.md` (root onboarding)
   - `docs/reference/INTEGRATION-GUIDE.md`
   - `COMPATIBILITY.md`
4. Migration hygiene aligned by renaming replay guard migration to semantic table purpose.

### Contract Implications
- v1 stability now explicitly includes:
  - reasonCode/responseClass envelope,
  - identity envelope header contract on protected routes,
  - internal trust context requirement for policy apply.

### Acceptance
This decision is considered fulfilled only when AP6 gates remain green after parity and docs updates.

## DR-2026-03-01-005 — Official Docs Baseline and Source-of-Truth Governance

- **Status:** Approved
- **Date:** 2026-03-01
- **Owner:** Joel + Sonny

### Decision
Handshake now treats documentation as a product surface with explicit source-of-truth governance.

### Core outcomes
1. Established official docs front-door (`docs/README.md`) with role-based paths.
2. Established contract governance doc (`docs/CONTRACT.md`) tied to OpenAPI as canonical schema truth.
3. Added operational, security, extensibility, and quality docs to reduce integrator/operator ambiguity.
4. Added backend sniff-test review artifact to continuously extract hardening backlog from documentation work.

### Why
As Handshake evolves, clear docs and explicit contract boundaries prevent user/agent/dev confusion and reduce integration breakage risk.

### Guardrail
No schema truth duplication outside OpenAPI; markdown explains behavior and usage, not alternative payload contracts.

## DR-2026-03-01-006 — Docs Comprehensiveness Uplift (Operational + Delegation + SLO Clarity)

- **Status:** Approved
- **Date:** 2026-03-01
- **Owner:** Joel + Sonny

### Decision
Expand official docs baseline to reduce third-party user/agent/dev confusion by adding explicit environment assumptions, secret-rotation runbook, delegation guardrails, and initial SLO/performance targets.

### Added Artifacts
- `docs/ops/ENVIRONMENT-MATRIX.md`
- `docs/ops/SECRET-ROTATION-RUNBOOK.md`
- `docs/security/DELEGATION-MODEL.md`
- `docs/quality/SLO-PERFORMANCE.md`

### Why
These topics are frequent integration failure points and major “WTF” sources when omitted from early platform docs.

### Constraint
SLO targets are initial and must be recalibrated with production telemetry.

## DR-2026-03-01-007 — Edge-Case-First Hardening as Ongoing Backend Discipline

- **Status:** Approved
- **Date:** 2026-03-01
- **Owner:** Joel + Sonny

### Decision
After AP6 core stabilization, backend quality progression is now edge-case-first:
1. document high-friction and reverse-case scenarios,
2. map each to deterministic expected behavior and reason-code outcomes,
3. promote critical edge checks into mandatory CI/runtime gates.

### Artifacts
- `docs/backend/EDGE-CASE-CATALOG.md`
- `docs/backend/EDGE-CASE-TEST-MATRIX.md`
- `docs/ops/DECISION-TREE.md`

### Why
Most trust loss occurs in boundary failures and ambiguous retries, not happy-path behavior.

### Constraint
Any new privileged flow must include edge-case mapping before release.

## DR-2026-03-01-008 — Documentation Consolidation Policy (Canonical Six)

- **Status:** Approved
- **Date:** 2026-03-01
- **Owner:** Joel + Sonny

### Decision
To prevent documentation sprawl and stale edge-case artifacts, Handshake adopts a canonical-six docs policy.

### Canonical Set
1. `docs/CONTRACT.md`
2. `docs/INTEGRATION.md`
3. `docs/OPERATIONS.md`
4. `docs/QUALITY.md`
5. `docs/ARCHITECTURE.md` (pointer)
6. `COMPATIBILITY.md`

### Policy
- Edge cases are maintained as a living matrix in `docs/QUALITY.md`.
- Operational decision trees/runbook essentials live in `docs/OPERATIONS.md`.
- New docs folders are disallowed unless approved due to sustained size/complexity pressure.
- Previous expanded docs are archived under `archive/docs-consolidated-2026-03-01/`.

## DR-2026-03-01-009 — WORKFLOWS.md as Post-Build Runtime Contract

- **Status:** Approved
- **Date:** 2026-03-01
- **Owner:** Joel + Sonny

### Decision
Handshake adopts `docs/WORKFLOWS.md` as the canonical post-build runtime behavior document, distinct from PRD/build planning artifacts.

### Why
PRD optimizes build intent; operations/integration require a maintained runtime contract with clear happy/failure paths and deterministic actions.

### Scope
`WORKFLOWS.md` covers:
- workflow submit/read/resolve flows,
- policy apply trust path,
- replay/idempotency behavior,
- incident branch for replay guard unavailability,
- cross-agent visibility and delegation guardrails.

### Constraint
Keep this doc living and concise; if behavior changes, update workflows + gates in same change set.

## DR-2026-03-01-010 — Slice 5 Finalization: Shim Removal, Composition Centralization, and Schema Preflight

- **Status:** Approved
- **Date:** 2026-03-01
- **Owner:** Joel + Sonny

### Decision
Finalize AP6/Slice architecture by:
1. Removing legacy workflow shim file,
2. Centralizing workflow service composition in route middleware context,
3. Adding schema preflight gate for tenant migration integrity.

### Why
Eliminate latent drift paths and ensure deploy safety for tenant-bound authorization guarantees.

### Contract Impact
No external API shape break intended. Internal architecture and CI guardrails hardened.
