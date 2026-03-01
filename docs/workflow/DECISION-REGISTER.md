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

