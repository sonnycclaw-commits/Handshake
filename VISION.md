# Handshake — Vision v2

> **The authorization layer for the agent economy.**

---

## The Problem

Agents need secrets to be useful. Giving agents secrets is dangerous.

**Current state:**
- Hardcoded secrets in prompts → exposed in logs
- Environment variables → still exposed to agent, no audit
- OAuth → designed for users, not agents
- Secrets managers → infrastructure for humans, not agent-native

**The gap:** No secrets authorization layer designed for agent-human collaboration.

---

## The Model: Exec + Company Card

Think of an executive giving an intern the company credit card.

The exec doesn't approve every coffee. They set **guardrails**:
- Daily spend cap: $50
- Category whitelist: food, transport
- Time bounds: business hours only

The intern acts **within bounds**. The exec reviews the **statement**.

When something unusual happens — $200 charge at 3am — the bank flags it. The exec approves or denies.

**This is Handshake's model: bounded autonomy + audit trail + HITL at boundaries.**

---

## What Handshake Is

Handshake is the **authorization layer** that sits between agents and secrets.

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  AGENT   │────▶│HANDSHAKE │────▶│  VAULT   │────▶│  ACTION  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                      │
                      │
                 ┌────▼────┐
                 │ HUMAN   │
                 │ (HITL)  │
                 └─────────┘
```

**Handshake does NOT store secrets.** It authorizes their use.

**BYO Vault:** Connect 1Password, AWS Secrets Manager, HashiCorp Vault, or environment variables. Handshake reads credentials at execution time, never exposes them to agents.

---

## Core Principles

### 1. Agent Never Handles Credentials

The agent requests a transaction. Handshake:
1. Verifies the agent is authorized
2. Checks against policies and guardrails
3. Fetches the credential from the vault
4. Executes the action
5. Returns a **sanitized result**

The agent never sees the credential value. Never sees credit card numbers. Never sees API keys.

### 2. Signed Manifest

The manifest declares what credentials an agent can request. It is:
- **Signed by the principal** (Ed25519 signature)
- **Read-only to the agent** (cannot be modified)
- **Versioned** (history preserved)

This prevents manifest poisoning (Red Hat Attack Vector #1).

### 3. Tiered Authorization

Not every action needs approval. HITL happens at boundaries:

| Tier | Trigger | Behavior |
|------|---------|----------|
| **0 — Auto** | Read operations, whitelisted endpoints, below threshold | Execute immediately, log |
| **1 — Silent** | Low-risk writes | Execute immediately, daily digest |
| **2 — One-tap** | Medium risk (payment $10-50) | Push notification, single tap |
| **3 — Confirm** | High risk (payment >$50, identity credentials) | Biometric/PIN confirmation |
| **4 — Quorum** | Critical (payment >$500, destructive ops) | Multiple approvers or cooldown |

This prevents approval fatigue (Red Hat Attack Vector #3).

### 4. Policy Engine

Principals set guardrails upfront. Agents act within them.

```yaml
policy:
  daily_spend_limit: 50
  allowed_categories: [food, transport, subscriptions]
  allowed_hours: "08:00-22:00"
  max_transaction: 30
```

Policies enable **bounded autonomy** — the agent can act without per-transaction approval.

### 5. Audit Everything

Every transaction is logged:
- Timestamp
- Agent ID
- Principal ID
- Credential type used (not value)
- Action taken
- Result (success/failure)
- Guardrails applied
- Risk score

The audit trail is the safety net. Principals review activity after the fact, like a credit card statement.

### 6. Response Sanitization

Third-party APIs leak information. "Card ending in 4567 charged $150" reveals partial card number.

Handshake sanitizes all responses before returning to agent:
- Redact credential fragments
- Redact error messages that reveal info
- Return success/failure + transaction ID only

This prevents result-only leakage (Red Hat Attack Vector #5).

### 7. Delegation Tokens

When Agent A delegates to Agent B (tachikoma):
- Agent A issues a **scoped delegation token**
- Token contains subset of permissions (never more than parent)
- Token is time-bound (expires in hours)
- Principal sees: "Agent A delegated to Agent B for [scope]"

This prevents delegation chain confusion (Red Hat Attack Vector #4).

---

## The Wedge

**Agent payments.**

Everyone wants agents to pay for things. No good solution exists.

- Stripe has payment links, but no agent-native delegation
- OAuth is too heavy for per-payment authorization
- Hardcoding credit cards is dangerous

Handshake enables: "My agent pays my bills, within limits I set, with an audit trail."

**Expansion path:** Payments → API purchases → subscriptions → all agent transactions.

---

## The Vision

If every interaction becomes agent-to-agent, every interaction needs accountability.

> **Handshake is the accountability layer for the post-interface internet.**

The universal credential:

```json
{
  "agent_id": "acme-store-agent",
  "principal_id": "jane-smith",
  "principal_display_name": "Jane Smith",
  "vault_connection": "1password",
  "granted_scopes": ["payment", "calendar", "email"],
  "policies": {
    "daily_spend_limit": 50,
    "allowed_hours": "08:00-22:00"
  },
  "trust_signals": {
    "status": "stable",
    "metrics": {
      "request_volume_24h": 1523,
      "failure_rate_24h": 0.01,
      "failed_auth_24h": 2,
      "hitl_timeout_rate_24h": 0.00
    },
    "drivers": ["low_failure_rate", "no_recent_incidents"],
    "recommended_mode": "auto"
  }
}
```

---


## Trust Posture (P5 Direction)

Trust in Handshake is **behavioral and transparent**, not opaque or proprietary.

- We surface operational telemetry (activity, failures, auth anomalies, HITL timeout patterns).
- We classify deterministic posture bands (`stable`, `degraded`, `unstable`).
- We always expose drivers and recommended mode so operators understand *why*.

This follows a detector model: degrade quickly on fault spikes, recover only with sustained stability.

## What We Build First

**Phase 1:** Foundation + Manifest + Audit (no external dependencies)
- Signed manifest system
- Agent registration
- Audit logging
- Response sanitization

**Phase 2:** Vault Adapters (needs vault credentials)
- 1Password Connect API
- AWS Secrets Manager
- Environment variables (dev mode)

**Phase 3:** Policy Engine + Tiered HITL
- Guardrails
- Approval tiers
- Telegram notifications

**Phase 4:** Dashboard
- Audit log viewer
- Agent management
- Policy configuration

---

## The Positioning

> **"Give your agent the company card — with limits, audit, and approval at the boundaries."**

---

## One Sentence

> **Handshake is the authorization layer for the agent economy — bounded autonomy, audit trail, human-in-the-loop at boundaries.**

---

**VISION v2 — Updated 2026-02-25**


---

## Canonical User Flow (v1)

1. Principal connects vault + sets initial guardrails.
2. Agent submits transaction request (no secret payload).
3. Handshake evaluates policy + tier.
4. If below boundary, execute via vault adapter and return sanitized result.
5. If at boundary, create HITL request and await decision/timeout.
6. Always write audit record and expose transaction status.

### Failure Flows (must-handle)

- Policy invalid/malformed -> fail closed (deny).
- Timestamp abuse/replay window breach -> reject.
- Credential ownership mismatch -> reject.
- HITL timeout/no response -> reject (default deny).
- Downstream vault/provider error -> safe normalized error, no secret leakage.


---

## Agent-First Positioning (Canonical)

**Handshake is the trust rail between agent intent and human authority.**

### Actor Model (4 actors)

1. Individual Principal (personal authority)
2. Entity Principal (org authority + governance)
3. Operator/Integrator (system implementer)
4. Agent Runtime (autonomous requester)

### Core Value to Agents

- Real agency within explicit boundaries
- Deterministic allow/deny/HITL outcomes
- Sanitized responses (no secret possession)
- Auditable execution history

## Canonical Runtime Flows (ASCII)

### Flow A — Happy Path (bounded auto-execution)

```
Agent -> Handshake: request(action, scope, context)
Handshake -> Policy Engine: evaluate(request, policy)
Policy Engine --> Handshake: allow, tier<=2
Handshake -> Vault Adapter: execute(credential_ref, action)
Vault Adapter --> Handshake: result
Handshake -> Sanitizer: redact(result)
Sanitizer --> Handshake: safe_result
Handshake -> Agent: safe_result + txn_id
Handshake -> Audit Log: append(event)
```

### Flow B — Boundary Path (HITL)

```
Agent -> Handshake: request(high-risk action)
Handshake -> Policy Engine: evaluate
Policy Engine --> Handshake: allow_with_hitl, tier>=3
Handshake -> HITL: create_request(ttl)
HITL -> Human: approve/deny prompt
Human --> HITL: decision OR timeout
HITL --> Handshake: approved|rejected|expired
Handshake -> Agent: decision + reason
Handshake -> Audit Log: append(event)
```

### Flow C — Fail-Closed Path

```
Agent -> Handshake: request
Handshake -> Guard Rails: validate(identity, manifest, delegation, timestamp)
Guard Rails --> Handshake: invalid
Handshake -> Agent: deny(normalized_error)
Handshake -> Audit Log: append(security_event)
```

### Flow D — Entity Governance Path

```
Entity Principal -> Policy: define limits + quorum rules
Operator -> Handshake: deploy config
Agent -> Handshake: request under entity policy
Handshake -> HITL: escalate to quorum when required
Approvers -> HITL: M-of-N decisions
Handshake -> Agent: approved|rejected
Handshake -> Audit: governance trail
```


## Execution Proof (30-Day Program Outcome)

The 30-day hardening program (W1-W4) completed with enforceable rails, not narrative claims:

- Legacy transitional risk paths removed/guarded.
- Least-privilege read scope hierarchy operational.
- Security/replay/tenant-boundary observability + alert-to-action loop established.
- Release discipline enforced via migration/env/invariant/checklist/watch gates in CI.

Residual risks are now operational calibration and anti-drift hygiene (documented in post-program smell test), not missing trust-boundary architecture.
