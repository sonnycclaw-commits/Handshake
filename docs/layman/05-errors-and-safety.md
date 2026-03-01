# Errors and Safety (What Happens When Blocked)

When Handshake blocks or fails an action, it returns structured outcomes.

## Key fields
- `reasonCode`: exact machine reason
- `responseClass`: broad behavior category (`ok`, `retryable`, `blocked`, `unknown`)

## Why this is useful
Frontend and operators can respond correctly:
- `ok` -> continue
- `retryable` -> retry with backoff
- `blocked` -> escalate or remediate
- `unknown` -> fail closed and inspect

## Safety principle
If trust is uncertain, Handshake defaults toward safe failure, not permissive success.
