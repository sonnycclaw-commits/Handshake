# Request Workflow Threat Model (Agent-Centric)

Status: Draft
Date: 2026-02-28

## Scope
Canonical request workflow (`allow|deny|escalate`) for agent-originated privileged actions.

## Security Objective
Guarantee that privileged effects are only possible through Handshake decision rails, with fail-closed behavior under uncertainty.

## Assets
1. Decision integrity (allow/deny/escalate correctness)
2. State integrity (terminal immutability)
3. Audit + lineage integrity
4. Reason-code machine semantics
5. Human approval authority integrity

## Trust Boundaries
- Agent runtime (untrusted for policy correctness)
- Handshake core (trusted policy/HITL/audit orchestration)
- External adapters/providers (partially trusted, failure-prone)
- Human approver channels (trusted identity, latency-prone)

## Top Threats

### T1 Prompt-shaped bypass
- Vector: agent attempts alternate privileged path after deny/escalate.
- Impact: policy evasion.
- Control: decision artifact required by privileged endpoints; bypass emits `security_*` and denies.

### T2 Reason laundering
- Vector: ambiguous errors interpreted as safe-to-retry.
- Impact: unsafe repeated actions.
- Control: canonical reason taxonomy + retry matrix by reason class.

### T3 Context-hash poisoning
- Vector: non-deterministic fields injected into context.
- Impact: parity/determinism loss.
- Control: whitelist hash inputs only; exclude surface/channel noise.

### T4 Escalation flood
- Vector: repeated boundary/ambiguous requests causing HITL overload.
- Impact: approval fatigue, bypass pressure.
- Control: per-agent escalation quotas, anomaly alerts, bounded backoff, optional temporary restricted mode.

### T5 Terminal race exploit
- Vector: callback reorder/late approvals attempting to flip terminal state.
- Impact: post-hoc unauthorized allow.
- Control: terminal-state-first checks, immutable terminal transitions, append-only audit/lineage.

### T6 Sensitive downgrade
- Vector: agent mislabels sensitive action as low risk.
- Impact: under-protected data/action.
- Control: server-side classification precedence over agent labels.

## Security Invariants
1. No privileged action outside handshake decision path.
2. Timeout and uncertainty fail closed.
3. Terminal states immutable.
4. Every request and terminal transition is auditable with standardized reason code.
5. Retry behavior follows reason-class policy; unknown classes fail closed.

## Test Hooks
- RW-004 / RW-010: bypass + integration-only checks
- RW-007: deterministic context parity
- RW-009: sensitive branch controls
- Additional hardening suites: race, flood, downgrade, retry-policy mapping
