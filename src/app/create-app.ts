import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { AppEnv } from '../core/types'
import { systemRoutes } from '../routes/system.routes'
import { workflowRoutes } from '../routes/workflow.routes'
import { operatorRoutes } from '../routes/operators.routes'
import { policyRoutes } from '../routes/policy.routes'
import { metricsRoutes } from '../routes/metrics.routes'

export function createApp() {
  const app = new Hono<AppEnv>()

  app.use('*', logger())

  // P0: Restrictive CORS - only allow explicit origins
  app.use('*', cors({
    origin: (origin) => {
      // Allow same-origin requests (empty origin for same-origin)
      if (!origin) return origin

      // Allowlist of permitted origins
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:8787',
        'https://handshake.example.com',
        // Add production origins here
      ]

      if (allowedOrigins.includes(origin)) {
        return origin
      }

      // Reject unknown origins
      return null
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Internal-Trust-Context'],
    maxAge: 86400,
    credentials: true,
  }))

  app.route('/', systemRoutes)
  app.route('/', workflowRoutes)
  app.route('/', operatorRoutes)
  app.route('/', policyRoutes)
  app.route('/', metricsRoutes)

  return app
}
