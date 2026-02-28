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
