# Handshake Onboarding Design Standard (v1)

Status: Draft (foundation)
Date: 2026-02-28
Owner: Sonny

## Purpose
Define the hardened, intuitive onboarding standard that drives product behavior, TDD, and implementation sequencing.

## North Star
**Time-to-First-Trust-Proof (TTFTP) <= 5 minutes**

A user must complete one guided workflow and leave onboarding with concrete trust evidence:
1. What agent action occurred
2. Why it was allowed/blocked
3. How to revoke immediately

---

## Non-Negotiable Principles

1. **Proof over promise**
   - Show live trust evidence before explanation-heavy copy.

2. **Progressive trust, not full trust upfront**
   - Start constrained (least privilege), expand with observed success.

3. **Exception-first human oversight**
   - HITL triggers on boundaries/high risk; never on every action.

4. **Deterministic policy outcomes**
   - Every action resolves to `allow | deny | escalate` with reason code.

5. **Non-bypassable control path (interaction/enforcement dependency)**
   - Privileged actions must require handshake evaluation.

6. **Visible and testable control**
   - Revoke/pause must be obvious and executable during onboarding.

7. **Machine-readable constraints**
   - Agent receives enforceable policy envelope, not UI-only labels.

8. **Fail closed on uncertainty**
   - Invalid policy/state/timestamp/ownership => deterministic reject.

9. **Audit by default**
   - Every material event captured with structured metadata.

10. **Low cognitive load**
    - Guided sequence with clear next step and progress visibility.

---

## Onboarding State Machine

```text
START
  -> IDENTITY_LINKED
  -> AGENT_BOUND
  -> POLICY_SELECTED
  -> GUIDED_RUN_STARTED
  -> TRUST_PROOF_SHOWN
  -> REVOKE_TESTED
  -> COMPLETE

Failure branches:
  any step -> BLOCKED(reason) -> RETRY(step)
  HITL timeout -> ESCALATION_EXPIRED -> SAFE_DENY -> CONTINUE
```

### Required step outcomes
- `IDENTITY_LINKED`: principal identity verified
- `AGENT_BOUND`: agent-principal linkage established
- `POLICY_SELECTED`: baseline guardrails applied
- `GUIDED_RUN_STARTED`: at least one controlled action attempted
- `TRUST_PROOF_SHOWN`: allow/deny/escalate evidence rendered
- `REVOKE_TESTED`: user confirms stop-control path works

---

## Onboarding Acceptance Contract (WF-00)

1. TTFTP <= 5 minutes (p95 measured in onboarding telemetry)
2. User completes >=1 policy-governed workflow
3. >=1 boundary event shown with standardized reason code
4. Revoke/pause control visible and validated
5. Agent-side policy envelope emitted in machine-readable form
6. No privileged action executes outside handshake decision path

---

## Observability Contract (minimum)

Capture these events:
- `onboarding_started`
- `identity_linked`
- `agent_bound`
- `policy_selected`
- `action_attempted`
- `action_allowed | action_denied | action_escalated`
- `hitl_approved | hitl_rejected | hitl_expired`
- `trust_proof_rendered`
- `revoke_tested`
- `onboarding_completed`

Required dimensions:
- principal_id, agent_id, workflow_id, policy_id, tier, reason_code, latency_ms, timestamp

---


## Actor Premortem Distill (PRD-aligned)

### Failure mode to design against
"Onboarding succeeds as demo, fails as control plane."

### Actor-specific breakpoints

- **Individual Principal**
  - Break: cannot quickly understand allow/deny reasons or trust revoke under pressure.
  - Design response: forced boundary event + reason clarity + revoke proof.

- **Entity Principal**
  - Break: audit evidence is non-portable/noisy for governance workflows.
  - Design response: decision-grade audit fields + export-ready structure from day one.

- **Operator / Integrator**
  - Break: integration ambiguity creates "temporary bypass" paths.
  - Design response: explicit enforcement boundary; no privileged side-paths.

- **Agent Runtime**
  - Break: policy envelope is ambiguous across channels/tools.
  - Design response: deterministic `allow|deny|escalate` contract with stable reason schema.

## White Hat / Red Hat Distill

### White Hat (keep)
- First Trust Proof <= 5 min is the right activation contract.
- Exception-first HITL is the right antidote to approval fatigue.
- Least-privilege start + progressive expansion is the right trust progression.

### Red Hat (harden)
- Biggest risk: Handshake is optional in production paths.
- Secondary risk: onboarding proof does not match live workflow behavior.
- Third risk: escalation tuning causes fatigue and silent control rollback.

## Non-Negotiable Invariants (for onboarding and beyond)

1. Privileged actions must traverse handshake evaluation path.
2. Timeout/uncertainty resolves fail-closed.
3. Revoke must be demonstrably effective during onboarding.
4. Every onboarding decision outcome includes machine-readable reason code.
5. Audit events must be decision-grade (not just logs).


## Principle -> TDD Mapping

| Principle | Primary TDD Coverage |
|---|---|
| Proof over promise | T-ONB-001, T-ONB-007, T-ONB-008 |
| Progressive trust | T-ONB-001, T-ONB-006 |
| Exception-first HITL | T-ONB-002, T-ONB-003 |
| Deterministic outcomes | T-ONB-007, T-ONB-014 |
| Non-bypassable path | T-ONB-005, T-ONB-011 |
| Visible/testable revoke | T-ONB-004, T-ONB-012 |
| Machine-readable constraints | T-ONB-006, T-ONB-014 |
| Fail closed on uncertainty | T-ONB-003, T-ONB-005 |
| Audit by default | T-ONB-008, T-ONB-013 |
| Low cognitive load | T-ONB-009, T-ONB-010 |

## UX Guardrail Questions (design review)

1. At minute 3, why would a skeptical user continue?
2. Can user answer “why was this blocked/allowed?” from UI alone?
3. Is revoke reachable in one obvious action?
4. Are we asking user to trust us, or showing them why they can?
5. Does any step assume prior protocol knowledge?
