# Request Retry Matrix (Agent Runtime Contract)

Status: Draft
Date: 2026-02-28

## Purpose
Define deterministic retry behavior for agent runtimes based on reason-code classes.

## Rule
Reason codes are machine-branch keys. Agent retries must follow this matrix.

| Reason Class | Example | Retry Policy | Notes |
|---|---|---|---|
| `security_*` | `security_handshake_required_bypass_denied` | `do_not_retry` | Requires security/operator intervention |
| `hitl_terminal_state_*` | `hitl_terminal_state_immutable` | `do_not_retry` | Terminal state cannot be mutated |
| `revoked_*` | `revoked_principal_control` | `do_not_retry` | Requires explicit principal reset |
| `trust_context_*` | `trust_context_missing_binding` | `retry_after_remediation` | Setup/binding must be fixed first |
| `policy_*` | `policy_sensitive_scope_denied` | `retry_after_remediation` | Do not retry unchanged request |
| `hitl_*` | `hitl_timeout_fail_closed` | `retry_after_remediation` | Requires renewed approval context |
| `adapter_*` / `provider_*` / `network_*` | `adapter_timeout` | `retry_with_backoff` | Bounded retries only |
| unknown | `x_unmapped` | `do_not_retry` | Fail closed by default |

## Runtime Constraints
1. Max retries are bounded and class-specific.
2. No speculative retry on `deny` without matrix-permitted path.
3. Unknown reason classes fail closed.
4. Retry decisions are auditable.
