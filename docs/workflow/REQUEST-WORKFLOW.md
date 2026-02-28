# Request Workflow (Agent -> Handshake)

Status: Draft (backend-first)
Date: 2026-02-28

## Intent
Define one canonical workflow for agent-originated requests.

Sensitivity is **not** a separate workflow.  
It is a **decision branch** inside this workflow.

---

## Core Principle

Every agent interaction is represented as a **Request**.

Handshake resolves each request deterministically to:
- `allow`
- `deny`
- `escalate` (HITL)

All outcomes are logged with reason codes and lineage.

---

## Canonical Request Object (conceptual)

```json
{
  "request_id": "req_xxx",
  "agent_id": "agent_xxx",
  "principal_id": "principal_xxx",
  "action_type": "payment|data_access|credential_use|external_call|other",
  "payload_ref": "opaque_ref",
  "context": {
    "channel": "api|chat|workflow",
    "timestamp": 0,
    "interaction_id": "int_xxx"
  }
}
```

Notes:
- Keep payload handling opaque/sanitized.
- Action semantics are evaluated through policy and risk rules, not ad hoc code paths.

---

## Workflow Stages

1. **Receive**
   - Validate shape, identity binding, timestamp, and request integrity.

2. **Classify**
   - Determine capability class and sensitivity profile.

3. **Evaluate Policy**
   - Match against principal/entity policy envelope.
   - Determine `allow|deny|escalate` + reason code.

4. **Resolve**
   - `allow`: proceed to adapter/use-case execution path.
   - `deny`: return deterministic rejection + actionable reason.
   - `escalate`: create HITL request and await terminal decision.

5. **Record**
   - Append audit event and lineage event regardless of outcome.

6. **Return**
   - Return normalized result object to caller.

---

## Sensitive Action Branch (inside stage 3)

Sensitive actions are identified via policy/risk dimensions, e.g.:
- money movement,
- confidential data access,
- credential-mediated external effects,
- irreversible operations.

Decision tree outcome:
- below threshold -> `allow`
- threshold exceeded / ambiguity -> `escalate`
- policy violation / invalid trust context -> `deny`

---

## Edge Cases (must-handle)

1. Missing principal binding -> `deny: missing_principal_binding`
2. Missing policy envelope -> `deny: policy_not_selected`
3. Privileged path bypass attempt -> `deny: handshake_required_bypass_denied`
4. Revoked principal control -> `deny: revoked_principal_control`
5. HITL timeout -> terminal `deny: hitl_timeout_fail_closed`
6. Late approval after terminal state -> `deny: hitl_terminal_state_*`
7. Malformed action shape -> `deny: malformed_action_shape`
8. Ownership mismatch / stale timestamp -> deterministic `deny`

---

## Applications (initial)

- Payment/expense requests
- Credential-bound API requests
- Confidential information access requests
- High-risk operational actions

All run through the same request workflow.

---

## Invariants

1. No privileged action outside handshake decision path.
2. All terminal outcomes are immutable.
3. Every request produces auditable, reason-coded trace.
4. Timeout and uncertainty fail closed.

---

## Next Docs

- `docs/workflow/REQUEST-STATE-MACHINE.md`
- `docs/workflow/REQUEST-REASON-CODES.md`
- `docs/workflow/REQUEST-TEST-MATRIX.md`


## Integration Premortem (Distilled)

### PM perspective
- Risk: friction exceeds perceived value, causing bypass pressure.
- Mitigation: adaptive escalation and clear "time saved" feedback loops.

### Technical perspective
- Risk: non-deterministic decisions across surfaces (IDE/API/workflow) and resume-state drift.
- Mitigation: single request contract, stable reason-code taxonomy, terminal-state immutability.

### White-hat perspective
- Opportunity: one portable trust rail across agent surfaces using existing HITL/policy/audit primitives.
- Requirement: compositional integration, not per-surface custom logic.

### User perspective
- Risk: prompt fatigue and unclear deny reasons reduce trust.
- Mitigation: exception-first prompts, actionable reason codes, visible revoke confidence.

## Approval/2FA Fatigue Strategy

Friction is real and manageable when approval is risk-adaptive:
1. auto-allow low-risk actions,
2. escalate boundary/high-risk actions,
3. use short-lived scoped approvals instead of broad permanent allows,
4. step-up only on anomaly or sensitivity spikes,
5. show exception-focused review, not constant prompt streams.

## Agent Behavior Integration Contract

Challenge: generic interaction requests can be harder for agents to operationalize than simple payment allow/deny flows.

To keep agent behavior reliable, the request workflow must expose a strict action loop:

```text
submit request -> receive deterministic outcome -> execute mapped next step
```

Outcome-to-behavior mapping (mandatory):
- `allow` -> continue workflow with returned txn/request artifact.
- `deny` -> stop current branch; execute reason-specific remediation step; retry only if remediable.
- `escalate` -> pause branch; await terminal HITL outcome; no speculative continuation.

### Why this matters
- Payments feel simpler because they naturally resolve to success/deny.
- For general interactions, ambiguity creeps in unless deny/escalate semantics are equally strict.
- Therefore, interaction requests must be encoded as finite-state transitions, not advisory hints.

## Request Finite-State Guidance

Recommended states:
- `submitted`
- `allowed`
- `denied_terminal`
- `escalated_pending`
- `escalated_approved`
- `escalated_rejected`
- `escalated_expired`

Rules:
1. Terminal states are immutable.
2. Late approvals after terminal reject/expire must deny.
3. Each transition emits audit+lineage event.
4. Agent runtime must treat state as source-of-truth over local heuristics.
