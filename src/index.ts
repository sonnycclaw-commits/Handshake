/**
 * Handshake API Bootstrap
 *
 * Front-matter rules (architecture guardrails):
 * 1) Keep this file thin: bootstrap/composition only (no domain/business logic).
 * 2) Route handlers belong in src/routes/* modules.
 * 3) Cross-cutting behavior belongs in middleware/core helpers, not inline route code.
 * 4) Domain decisions stay in use-cases/domain services, never in index.ts.
 * 5) AP6 discipline: RED tests/spec checks first, implementation second.
 *
 * If this file grows beyond bootstrap responsibilities, treat it as architecture drift
 * and refactor back into route/core modules.
 */

import { createApp } from './app/create-app'

const app = createApp()

export default app
