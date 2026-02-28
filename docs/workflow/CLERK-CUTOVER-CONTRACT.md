# Clerk Cutover Contract (P1)

Status: Draft (Implementation Target)
Date: 2026-02-28

## Goal
Use Clerk as the canonical identity provider for Handshake while preserving trust/policy/audit behavior.

## Canonical Identity Inputs (from Clerk)
Required claims (validated):
- `sub` (string) → canonical principal identity
- `exp` (number) → token expiry (fail if expired)
- `iat` (number) → token issue time

Context checks:
- `azp` must be in allowlist (`authorizedParties`)
- `aud` must match configured audience when set

## Handshake Mapping Rules
- `principalId` = `sub`
- `ownerProvider` = `clerk`
- `ownerId` = `sub`
- `ownerDisplayName` = optional metadata only (never authz-critical)

## Security Rules
1. Fail closed on missing/invalid token.
2. Fail closed on audience/authorized party mismatch.
3. Accept only session tokens unless explicitly expanded.
4. No authorization decisions from untrusted custom claims.
5. Emit canonical reason codes for all Clerk auth failures.

## Modes
- `IDENTITY_PROVIDER=legacy`: existing direct OAuth behavior.
- `IDENTITY_PROVIDER=clerk`: direct OAuth endpoints disabled; Clerk verification required.

## Endpoint Behavior in Clerk Mode
- `GET /verify` (legacy OAuth start): reject with explicit migration error.
- `GET /callback` (legacy OAuth callback): reject with explicit migration error.
- Token-based flows continue through validated Clerk identity.

## Deferred (P2+)
- Full Clerk adapter implementation (`authenticateRequest`/`verifyToken`).
- Machine token support (if needed) behind explicit policy.
