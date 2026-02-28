#!/usr/bin/env bash
set -euo pipefail

# Rollback clerk mode to legacy mode for production Worker
# Usage: ./scripts/rollback-to-legacy.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[rollback] Setting IDENTITY_PROVIDER=legacy in production..."
printf "%s" "legacy" | npx wrangler secret put IDENTITY_PROVIDER --env production

echo "[rollback] Deploying production worker..."
npx wrangler deploy --env production

echo "[rollback] Running smoke checks..."
curl -fsS https://handshake-production.sonny-c-claw.workers.dev/ >/dev/null
curl -fsS https://handshake-production.sonny-c-claw.workers.dev/.well-known/jwks.json >/dev/null

echo "[rollback] SUCCESS: production rolled back to legacy mode."
