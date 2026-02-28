# Handshake Onboarding Flow v1 (High-Level)

Date: 2026-02-28
Status: Draft for ideation/design

## Truth #1 (Non-Negotiable)

**Handshake must be a mandatory enforcement gate, not a voluntary compliance layer.**

If an agent can bypass Handshake, Handshake is UX theater.

---

## Onboarding Goal

In <5 minutes, a user should trust that:
1. Agent actions are visible,
2. permissions are enforced,
3. high-risk actions cannot bypass the gate,
4. control can be revoked instantly.

---

## Flow (Minute-by-minute)

### 0:00–0:30 — Why Handshake (Value Frame)
- Message: "Delegate safely, not blindly."
- Promise: "See every action. Know why it was allowed. Stop it anytime."

### 0:30–1:30 — Connect Identity + Agent
- Link human identity (owner/principal)
- Register agent identity (engaging entity)
- Establish relationship: who stands behind this agent

### 1:30–2:30 — Select Enforcement Policy
- Choose policy template (Low / Medium / High autonomy)
- Explicitly show: allowed / blocked / escalated
- Deny-by-default for privileged actions without valid handshake envelope

### 2:30–4:00 — Run Guided Test Workflow
- Agent attempts a realistic workflow
- Gate enforces protocol on each step
- If action is high-risk, require HITL approval
- If action is out-of-policy, block and log

### 4:00–5:00 — Show Trust Proof
- Live action feed (what happened)
- Authority reason per action (why allowed/blocked)
- Handshake graph (who talked to who)
- One-click revoke/pause control

---

## Acceptance Criteria (for design/build)

- User reaches first successful, policy-compliant run in <5 minutes
- At least one blocked/escalated event is visible during onboarding
- Revocation control is visible and testable before onboarding ends
- No privileged action can execute without handshake verification

---

## Design Guardrail Questions

1. Can this step be bypassed by direct API call?
2. Does user see policy effect in real time?
3. Does agent receive machine-readable constraints (not just UI labels)?
4. Would a skeptical operator trust this after minute 5?
