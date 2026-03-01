import { Hono } from 'hono'
import type { AppEnv } from '../core/types'
import {
  configureWorkflowStores,
  statusForReasonCode,
  toStructuredError,
} from '../core/workflow'
import { createWorkflowServices } from '../core/workflow-services'
import { requireIdentityEnvelope } from '../middleware/identity-envelope'
import { resolveDecisionActionUseCase } from '../use-cases/workflow/resolve-decision-action'
import { submitWorkflowRequestUseCase } from '../use-cases/workflow/submit-workflow-request'
import { getWorkflowRequestUseCase } from '../use-cases/workflow/get-workflow-request'
import { getDecisionRoomUseCase } from '../use-cases/workflow/get-decision-room'
import { authorizeExecutionUseCase } from '../use-cases/workflow/authorize-execution'
import { getWorkflowEvidenceUseCase } from '../use-cases/workflow/get-workflow-evidence'

export const workflowRoutes = new Hono<AppEnv>()


workflowRoutes.use('/workflow/*', async (c, next) => {
  configureWorkflowStores(c.env)
  c.set('workflowServices', createWorkflowServices(c.env))
  await next()
})
// P0: Protect all decision-room endpoints with identity envelope
workflowRoutes.use('/workflow/decision-room/*', requireIdentityEnvelope)

// P0: Protect read-side workflow endpoints with identity envelope
workflowRoutes.use('/workflow/requests/:requestId', requireIdentityEnvelope)
workflowRoutes.use('/workflow/evidence/:requestId', requireIdentityEnvelope)

workflowRoutes.post('/workflow/requests', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'Invalid JSON body'), statusForReasonCode('trust_context_invalid_request_shape'))
  }

  const { requestWorkflowService } = c.get('workflowServices') as any
  const out = await submitWorkflowRequestUseCase({ service: requestWorkflowService, env: c.env, bodyRaw: body })
  return c.json(out.body as any, out.status as any)
})

workflowRoutes.get('/workflow/requests/:requestId', async (c) => {
  const out = await getWorkflowRequestUseCase({
    env: c.env,
    requestId: c.req.param('requestId'),
    identityEnvelope: c.get('identityEnvelope') as any,
  })
  return c.json(out.body as any, out.status as any)
})

workflowRoutes.get('/workflow/decision-room/:requestId', async (c) => {
  const out = await getDecisionRoomUseCase({
    env: c.env,
    requestId: c.req.param('requestId'),
    identityEnvelope: c.get('identityEnvelope') as any,
  })
  return c.json(out.body as any, out.status as any)
})

workflowRoutes.post('/workflow/decision-room/action', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'Invalid JSON body'), statusForReasonCode('trust_context_invalid_request_shape'))
  }

  const { requestWorkflowService } = c.get('workflowServices') as any
  const out = await resolveDecisionActionUseCase({
    service: requestWorkflowService,
    env: c.env,
    bodyRaw: body,
    idemKey: c.req.header('x-idempotency-key'),
    identityEnvelope: c.get('identityEnvelope') as { principalId?: string; subjectType?: string } | undefined,
  })

  return c.json(out.body as any, out.status as any)
})

workflowRoutes.post('/workflow/authorize-execution', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(toStructuredError('trust_context_invalid_request_shape', 'Invalid JSON body'), statusForReasonCode('trust_context_invalid_request_shape'))
  }

  const { requestWorkflowService } = c.get('workflowServices') as any
  const out = await authorizeExecutionUseCase({ service: requestWorkflowService, bodyRaw: body })
  return c.json(out.body as any, out.status as any)
})

workflowRoutes.get('/workflow/evidence/:requestId', async (c) => {
  const { requestWorkflowService } = c.get('workflowServices') as any
  const out = await getWorkflowEvidenceUseCase({
    service: requestWorkflowService,
    env: c.env,
    requestId: c.req.param('requestId'),
    identityEnvelope: c.get('identityEnvelope') as any,
  })
  return c.json(out.body as any, out.status as any)
})
