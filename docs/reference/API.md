# Handshake API Reference

> Core interfaces for agent authorization

---

## Table of Contents

1. [Services](#services)
   - [createManifest](#createmanifest)
   - [signManifest](#signmanifest)
   - [verifyManifestSignature](#verifymanifestsignature)
2. [Entities](#entities)
   - [Manifest](#manifest)
   - [SignedManifest](#signedmanifest)
3. [Value Objects](#value-objects)
   - [Tier](#tier)
   - [CredentialType](#credentialtype)
   - [CredentialId](#credentialid)
4. [Errors](#errors)
5. [HITL Operational Contract (SLO)](#hitl-operational-contract-slo)

---

## Services

### createManifest

Creates a validated Manifest from plain input.

```typescript
import { createManifest } from '@handshake/domain/services/create-manifest'

const manifest = createManifest({
  agentId: 'agent_123',
  principalId: 'principal_456',
  credentials: [
    { type: 'payment_method', id: 'cred_123', tier: 2 }
  ],
  createdAt: Date.now(),
  expiresAt: Date.now() + 3600000,
  version: '1.0'
})
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | string | ✓ | Agent identifier (max 256 chars) |
| `principalId` | string | ✓ | Principal identifier (max 256 chars) |
| `credentials` | CredentialInput[] | ✓ | Array of credentials (max 100) |
| `createdAt` | number | ✓ | Unix timestamp (ms) |
| `expiresAt` | number | ✓ | Unix timestamp (ms), must be > createdAt + 1000ms |
| `version` | string | ✓ | Manifest version ('1.0') |

**Returns:** `Manifest`

### signManifest

Signs a manifest with Ed25519 private key.

### verifyManifestSignature

Verifies a signed manifest's signature.

---

## Entities

### Manifest

Immutable entity representing an authorization request.

### SignedManifest

Immutable entity containing manifest + signature.

---

## Value Objects

### Tier

Security tier for credential classification.

### CredentialType

Validated credential type identifier.

### CredentialId

Validated credential identifier.

---

## Errors

### SignatureError

Thrown when signature verification fails.

---

## HITL Operational Contract (SLO)

### State + Semantics

- `pending -> approved | rejected | expired`
- `expired` is rejection-semantic for execution (no implicit allow)
- terminal states are immutable

### Authority

- approval must come from authorized principal for that request
- unauthorized approver attempts are rejected and auditable

### Timeout + Retry Contract

- default timeout action: reject
- no human response by TTL must produce deterministic reject
- retrying timeout processing must be idempotent (same terminal result)

### Audit Contract

Each HITL transition must emit an audit event with:
- `request_id`
- `actor_id` (or `system_timeout`)
- `from_state` / `to_state`
- `reason`
- `timestamp`

### Operational Targets (initial)

- Decision finalization correctness: **100%** (no implicit allow)
- Unauthorized approval acceptance: **0%**
- Timeout-to-reject correctness: **100%**
- Transition audit write success: **>= 99.9%**

---

**Version:** 1.1
**Last Updated:** 2026-02-27
