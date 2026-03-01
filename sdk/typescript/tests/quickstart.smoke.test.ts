import { describe, it, expect } from 'vitest'
import { HandshakeClient } from '../src/handshake-client'
import { HandshakeApiError } from '../src/errors'

const identityEnvelope = {
  principalId: 'p1',
  subjectType: 'human' as const,
  roles: ['operator'],
  scopes: ['workflow:resolve'],
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (input instanceof Request) return input.url
  return String(input)
}

describe('SDK quickstart smoke', () => {
  it('exposes ergonomic wrappers for core rails', async () => {
    const client = new HandshakeClient({
      baseUrl: 'http://localhost',
      fetchImpl: async () => new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    })

    expect(typeof client.workflow.submitRequest).toBe('function')
    expect(typeof client.workflow.resolveAction).toBe('function')
    expect(typeof client.workflow.getRequest).toBe('function')
    expect(typeof client.workflow.getDecisionRoom).toBe('function')
    expect(typeof client.workflow.evidence).toBe('function')
    expect(typeof client.policy.simulate).toBe('function')
    expect(typeof client.policy.apply).toBe('function')
    expect(typeof client.agents.list).toBe('function')
    expect(typeof client.entities.list).toBe('function')

    const res = await client.workflow.submitRequest({
      requestId: 's1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'x',
      timestamp: Date.now(),
    })
    expect(res.status).toBe('ok')
  })

  it('injects trust-boundary headers for protected operations', async () => {
    const seen: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []

    const client = new HandshakeClient({
      baseUrl: 'http://localhost',
      fetchImpl: async (input, init) => {
        seen.push({ input, init })
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })

    await client.workflow.getRequest('r1', identityEnvelope)
    await client.workflow.getDecisionRoom('r1', identityEnvelope)
    await client.workflow.evidence('r1', identityEnvelope)
    await client.workflow.resolveAction({ requestId: 'r1', hitlRequestId: 'h1', action: 'approve' }, identityEnvelope, 'idem-1')
    await client.policy.apply({ scope: 'global', rules: [{ id: 'r1', key: 'max_payment', value: 50 }] }, identityEnvelope, 'trust-token')

    const requestCall = seen.find((x) => requestUrl(x.input).includes('/workflow/requests/r1'))
    const roomCall = seen.find((x) => requestUrl(x.input).includes('/workflow/decision-room/r1'))
    const evidenceCall = seen.find((x) => requestUrl(x.input).includes('/workflow/evidence/r1'))
    const actionCall = seen.find((x) => requestUrl(x.input).includes('/workflow/decision-room/action'))
    const applyCall = seen.find((x) => requestUrl(x.input).includes('/policy/apply'))

    expect(requestCall).toBeDefined()
    expect(roomCall).toBeDefined()
    expect(evidenceCall).toBeDefined()
    expect(actionCall).toBeDefined()
    expect(applyCall).toBeDefined()

    const requestHeaders = new Headers((requestCall?.input as Request).headers ?? requestCall?.init?.headers)
    const roomHeaders = new Headers((roomCall?.input as Request).headers ?? roomCall?.init?.headers)
    const evidenceHeaders = new Headers((evidenceCall?.input as Request).headers ?? evidenceCall?.init?.headers)
    const actionHeaders = new Headers((actionCall?.input as Request).headers ?? actionCall?.init?.headers)
    const applyHeaders = new Headers((applyCall?.input as Request).headers ?? applyCall?.init?.headers)

    expect(requestHeaders.get('x-identity-envelope')).toContain('"principalId":"p1"')
    expect(roomHeaders.get('x-identity-envelope')).toContain('"principalId":"p1"')
    expect(evidenceHeaders.get('x-identity-envelope')).toContain('"principalId":"p1"')

    expect(actionHeaders.get('x-identity-envelope')).toContain('"principalId":"p1"')
    expect(actionHeaders.get('x-idempotency-key')).toBe('idem-1')

    expect(applyHeaders.get('x-identity-envelope')).toContain('"principalId":"p1"')
    expect(applyHeaders.get('x-internal-trust-context')).toBe('trust-token')
  })

  it('normalizes API errors to HandshakeApiError with retryability', async () => {
    const client = new HandshakeClient({
      baseUrl: 'http://localhost',
      fetchImpl: async () => new Response(JSON.stringify({
        status: 'error',
        error: 'security_missing_identity_envelope',
        reasonCode: 'security_missing_identity_envelope',
        responseClass: 'blocked',
        message: 'Identity envelope required',
      }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    })

    await expect(client.workflow.submitRequest({
      requestId: 's1',
      principalId: 'p1',
      agentId: 'a1',
      actionType: 'payment',
      payloadRef: 'x',
      timestamp: Date.now(),
    })).rejects.toBeInstanceOf(HandshakeApiError)

    try {
      await client.workflow.submitRequest({
        requestId: 's2',
        principalId: 'p1',
        agentId: 'a1',
        actionType: 'payment',
        payloadRef: 'x',
        timestamp: Date.now(),
      })
    } catch (err: any) {
      expect(err.reasonCode).toBe('security_missing_identity_envelope')
      expect(err.responseClass).toBe('blocked')
      expect(err.retryable).toBe(false)
    }
  })
})
