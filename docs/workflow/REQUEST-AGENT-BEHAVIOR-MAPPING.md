# Request -> Agent Behavior Mapping

Status: Draft
Date: 2026-02-28

## Purpose
Define deterministic next-step behavior for agent runtimes consuming Handshake request decisions.

## Contract

Agent must treat Handshake decision as authoritative:
- `allow`
- `deny`
- `escalate`

No speculative continuation is permitted after `deny` or `escalate`.

---

## Decision Mapping

| Decision | Agent Action | Retry Rule |
|---|---|---|
| allow | Continue branch; persist returned artifact id | N/A |
| deny | Halt branch; surface reason code; apply remediation if available | Retry only when reason is remediable |
| escalate | Pause branch; await terminal HITL outcome | No retry while pending |

---

## Remediation Classes (for deny)

| Reason Class | Example | Agent Response |
|---|---|---|
| Missing trust context | `missing_principal_binding`, `policy_not_selected` | Trigger setup/binding flow, then retry |
| Policy violation | `out_of_policy`, `disallowed_category` | Do not retry unchanged; require policy/user change |
| Security violation | `handshake_required_bypass_denied`, `malformed_action_shape` | Stop and flag security event; no auto-retry |
| Terminal control | `revoked_principal_control`, `hitl_terminal_state_*` | Stop branch permanently until explicit reset |

---

## Escalation Handling

Pending HITL states must block branch execution:
- `escalated_pending` -> await decision
- `escalated_approved` -> continue
- `escalated_rejected` -> deny terminal
- `escalated_expired` -> deny terminal (fail-closed)

Late approval after terminal state is invalid and must resolve to deny.

---

## Runtime Requirements

1. Persist request and outcome ids in agent memory/context.
2. Treat reason codes as machine-level branching keys.
3. Never bypass with direct privileged side-path.
4. Keep branch-level idempotency to avoid duplicate requests on retries.
