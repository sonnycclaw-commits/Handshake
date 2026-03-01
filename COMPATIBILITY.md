# Handshake Compatibility Policy (v1)

## Stability Guarantees

For v1, these are treated as stable integration contracts:

1. OpenAPI schemas in `openapi/handshake.v1.yaml`
2. Error envelope fields: `error`, `reasonCode`, `responseClass`
3. Protected-route auth contract: `x-identity-envelope`
4. Policy apply trust contract: `x-internal-trust-context`

## Change Classes

- **Patch**: internal fixes, no schema breaks, no auth contract changes.
- **Minor**: additive fields/endpoints; backwards compatible.
- **Major**: breaking schema/auth/behavior contract changes.

## Deprecation Window

- Any planned breaking change must be announced with migration guidance.
- Default deprecation window target: one minor cycle before major removal.

## CI Contract Enforcement

Release gates must pass:

- `npm run check:openapi`
- `npm run check:sdk-drift`
- `npm run test:ap6-gate`
- `npm run test:prod-gate`
- `npm run test:sdk-smoke`

## Builder Rule

If an internal refactor changes behavior visible to builders, it is not internal. Treat it as contract work.
