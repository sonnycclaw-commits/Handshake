# Clerk Cutover Test Matrix (P1/P2)

## Unit
- Clerk token valid -> principal mapped from `sub`
- Expired token -> denied
- Invalid signature -> denied
- `azp` mismatch -> denied
- `aud` mismatch -> denied
- Missing `sub` -> denied

## Integration
- Legacy mode: `/verify` + `/callback` unchanged
- Clerk mode: `/verify` returns explicit disabled response
- Clerk mode: `/callback` returns explicit disabled response
- Clerk mode: trust/policy/audit paths remain deterministic

## Security Regression
- No authz decisions from non-validated custom claims
- Canonical error/reason code mapping present
- Fail-closed behavior on all parser/verification errors

## Operational
- Startup validation fails when `IDENTITY_PROVIDER=clerk` and Clerk config missing
- Metrics/logs identify auth failures by reason class
