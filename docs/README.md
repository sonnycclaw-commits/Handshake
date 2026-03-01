# Handshake Docs (Canonical Set)

Keep docs lean. Canonical files:

1. `CONTRACT.md` — API/trust contract rules
2. `INTEGRATION.md` — how to integrate quickly and correctly
3. `OPERATIONS.md` — deploy/incident/runbook essentials
4. `WORKFLOWS.md` — post-build runtime behavior contract
5. `QUALITY.md` — gates, checklist, edge-case matrix
6. `ARCHITECTURE.md` — pointer to architecture source
7. `../COMPATIBILITY.md` — stability and versioning policy

Schema truth is always OpenAPI:
- `../openapi/handshake.v1.yaml`

Do not create new top-level docs unless one canonical file exceeds practical size.
