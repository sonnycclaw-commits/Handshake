# Permissions and Limits (How Access Works)

Handshake separates access into three layers:

## 1) Roles
Roles are broad job types (example: operator, admin).

## 2) Scopes
Scopes are specific abilities (example: `workflow:read:tenant`, `workflow:resolve`).

## 3) Policy limits
Policies add guardrails like:
- max transaction amount,
- allowed hours,
- category restrictions,
- escalation thresholds.

## Why this structure works
- Roles alone are too broad
- Scopes alone can still drift
- Policy limits make scope usage safe in context

Together they support bounded autonomy: agent can move fast but inside rules.
