# Handshake Thesis Validation Register

Date: 2026-02-28  
Status: Active (living register)
Owner: Sonny + Joel

Purpose: Continuously prove/disprove core Handshake assumptions with external evidence, explicit falsification criteria, and decision impact.

---

## Scoring

- **Confidence:** 1 (low) → 5 (high)
- **Evidence Quality:** Low / Medium / High
- **Status:** Unvalidated / Validating / Supported / Challenged / Falsified / Parked

---

## Register

| ID | Hypothesis | Why it matters | Current confidence | Status | Supporting evidence | Disconfirming evidence | Falsification test | Next validation action | Owner | Last updated |
|---|---|---|---:|---|---|---|---|---|---|---|
| H-001 | Agent action volume will outpace practical human oversight | Core reason trust layer is needed | 4 | Supported | Industry shift toward autonomous workflows; HITL fatigue signals | Teams may keep agents in low-autonomy mode longer than expected | If most target users keep full manual approvals in production >12 months | Interview users on approval throughput + bottlenecks | Joel/Sonny | 2026-02-28 |
| H-002 | Buyers prioritize blast-radius reduction over autonomy narratives | Positioning and onboarding messaging hinge on this | 4 | Supported | “Bounded autonomy” and risk framing recurring in enterprise discourse | Some early adopters may prioritize speed over safety | If high-intent users consistently choose “max autonomy” despite visible risk controls | A/B test messaging: “autonomy” vs “bounded control” | Sonny | 2026-02-28 |
| H-003 | Trust primitives (identity, authority, audit, revocation) become mandatory rails | Defines product scope and moat | 4 | Supported | OWASP/NIST-style governance themes; enterprise audit/revocation patterns | SMB/indie users may accept weaker controls | If active deployments do not require auditable controls for meaningful workflows | Validate procurement/security checklists from real teams | Joel | 2026-02-28 |
| H-004 | Model-agnostic trust is mandatory (provider/runtime swaps are normal) | Prevents vendor lock-in; key survivability condition | 3 | Validating | Multi-model routing patterns increasing | Some orgs may standardize on single vendor for years | If 80%+ target users remain single-model and see no need for portability | Survey target segment on routing/provider strategy | Sonny | 2026-02-28 |
| H-005 | Onboarding must prove value in <5 minutes or adoption drops sharply | Critical GTM + UX constraint | 3 | Validating | Strong product intuition; high-friction onboarding known churn point | Trust setup may require more context in regulated settings | If users complete >5 min onboarding with strong activation and low dropoff | Prototype timed onboarding and measure completion/activation | Sonny | 2026-02-28 |
| H-006 | Machine-readable policy must directly govern agent behavior (not just display) | Avoids “policy theater” | 5 | Supported | Core architectural requirement; aligns with trust claim | Teams may fake controls via UI prompts only | If policy changes do not reliably alter runtime behavior | Build conformance tests: policy delta → behavior delta | Sonny | 2026-02-28 |
| H-007 | Decision fatigue is a primary failure mode for HITL systems | Drives exception-first escalation design | 4 | Supported | Approval fatigue/rubber-stamping patterns seen in automation domains | Some low-volume domains may tolerate full review | If users prefer reviewing everything and maintain quality/latency | Test escalation precision + reviewer load metrics | Joel/Sonny | 2026-02-28 |
| H-008 | Early wedge can create trust artifact portability and network effects | Long-term defensibility | 2 | Validating | Theoretical strong upside | May remain feature-level with weak cross-party pull | If counterparties do not value external trust artifacts | Run partner interviews: would artifact affect acceptance/risk scoring? | Joel | 2026-02-28 |
| H-009 | Revocation must be instant and reliable to sustain institutional trust | Non-negotiable control plane requirement | 5 | Supported | Common security/compliance expectation | Some low-risk use cases may not demand strict immediacy | If delayed revocation does not impact trust/adoption in target users | Define and test revocation SLO + incident simulations | Sonny | 2026-02-28 |
| H-010 | Interoperability across channels/tools/agents is required for durability | Prevents platform-specific dead-end | 3 | Validating | Ecosystem fragmentation suggests need | Some vendors may force closed ecosystems successfully | If closed ecosystems dominate target segment and win despite lock-in | Map target users’ channel/tool heterogeneity | Joel/Sonny | 2026-02-28 |

---

## Decision Rule

- Promote hypothesis to **Supported (operational)** when:
  1. Evidence quality is Medium/High,
  2. At least one real-world validation cycle completed,
  3. No strong contradictory signal remains unresolved.

- Mark **Challenged** when credible contradictory data appears.
- Mark **Falsified** when falsification criteria are met.

---

## Promotion to ADR

Create/Update ADR only when a hypothesis outcome changes:
1) architecture,  
2) onboarding flow,  
3) GTM positioning, or  
4) security/trust control boundaries.

---

## Cadence

- Review cadence: Weekly
- Trigger immediate review when: major market event, significant incident, or contradictory customer signal
- Keep changes append-only in changelog below

---

## Changelog

- 2026-02-28: Initial register created from thesis + discussion assumptions.
