# W4 24h Watch Hooks (D5)

Purpose: monitor first 24 hours after release for high-signal governance/security regressions.

## Mandatory signals

1. `alert_replay_guard_unavailable`
- Threshold: `>= 1`
- Action: execute replay guard recovery runbook immediately.

2. `alert_denial_spike`
- Threshold: denial rate `> 0.3`
- Action: run denial trend triage (reason-family + endpoint analysis).

3. `alert_tenant_mismatch_spike`
- Threshold: tenant mismatch rate `> 0.05`
- Action: validate tenant claim mapping and scope enforcement path.

## Operator action matrix

| Signal | First response | Escalate when | Closure condition |
|---|---|---|---|
| replay_guard_unavailable | Pause privileged mutations, validate replay store | >15m unresolved | replay guard restored + checks green |
| denial_spike | Inspect metrics reasons/series, isolate source | sustained >30m | denial rate back below threshold + cause documented |
| tenant_mismatch_spike | Verify envelope tenant mapping and scope paths | any suspected leakage risk | mismatch rate normalized + parity checks green |

## Validation
Configuration source for automated checks:
- `docs/workflow/W4-24H-WATCH.json`
