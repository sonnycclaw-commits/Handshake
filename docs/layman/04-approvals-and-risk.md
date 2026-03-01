# Approvals and Risk (HITL)

HITL means **Human-In-The-Loop**.

Not every agent action should require approval. That causes fatigue and slows work.

Handshake uses risk tiers:
- Low risk: auto-allow inside policy
- Medium risk: lightweight approval
- High risk: explicit confirmation
- Critical risk: stricter approval pattern

## Goal
Humans should approve exceptions, not every routine action.

## Result
- Better speed on safe actions
- Better control on risky actions
- Less approval noise
