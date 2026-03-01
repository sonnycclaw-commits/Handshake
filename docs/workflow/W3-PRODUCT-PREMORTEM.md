# W3 Product Premortem — Observability UX & Adoption Risk

Date: 2026-03-01
Owner: Sonny
Scope: Post-C1/C2/C3/C4 product-operability risks

## Objective
Ensure W3 observability improvements create real operator leverage (faster diagnosis + safer action), not dashboard theater.

## Failure Modes

1. Metrics are technically correct but not decision-useful.
- Symptom: Operators can see trends but cannot decide what action to take.
- Prevention: alert->runbook mapping enforced (C4), reason-family and endpoint dimensions retained.

2. Alert fatigue from poorly tuned thresholds.
- Symptom: frequent denial-spike alerts during expected noisy integration windows.
- Prevention: threshold configuration explicit + environment-calibrated tuning plan.

3. Integration trust erosion due to contract surprise.
- Symptom: clients break on stricter metrics query constraints.
- Prevention: OpenAPI enum + deterministic 400 blocked response + docs alignment.

4. Security signal blind spots remain.
- Symptom: replay-guard unavailability appears only in logs, not action rails.
- Prevention: dedicated replay-guard unavailable alert + operator runbook.

## Product Guardrails

- Any alert class must map to one concrete operator action path.
- No metric exposed without a corresponding interpretation guideline.
- No query rail accepts unbounded/unknown metric keys in production.
- Keep fail-closed semantics unchanged while adding observability.

## Next Product Checks

- Run a 7-day threshold tuning trial by environment (staging/prod).
- Add top-3 operator dashboard cards and validate mean-time-to-diagnosis reduction.
- Collect 3 real incident traces and test if runbooks resolve without source-code deep dive.
