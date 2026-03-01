import {
  applyPolicy,
  getAgent,
  getDecisionRoom,
  getEntity,
  getPolicyConfig,
  getWorkflowEvidence,
  getWorkflowRequest,
  listAgents,
  listEntities,
  resolveDecisionAction,
  simulatePolicy,
  submitWorkflowRequest,
  type ApplyPolicyData,
  type DecisionActionInput,
  type ErrorResponse,
  type GetPolicyConfigData,
  type PolicyApplyInput,
  type PolicyScope,
  type ResolveDecisionActionData,
  type SubmitWorkflowRequestData,
} from '../generated'
import { createClient } from '../generated/client'
import type { Client as GeneratedClient, Config as GeneratedClientConfig } from '../generated/client'
import { toHandshakeApiError } from './errors'

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type HandshakeClientOptions = {
  baseUrl: string
  fetchImpl?: FetchLike
  authToken?: string
  defaultHeaders?: Record<string, string>
}

export type IdentityEnvelope = {
  principalId: string
  subjectType: 'human' | 'service' | 'agent'
  roles: string[]
  scopes: string[]
  issuer?: string
  sessionId?: string
  tenantId?: string
}

export type InternalTrustTokenProvider = () => string

function jsonHeader(value: unknown): string {
  return JSON.stringify(value)
}

function buildGeneratedClient(opts: HandshakeClientOptions): GeneratedClient {
  const config: GeneratedClientConfig = {
    baseUrl: opts.baseUrl,
    headers: {
      ...(opts.defaultHeaders ?? {}),
      ...(opts.authToken ? { authorization: `Bearer ${opts.authToken}` } : {}),
    },
    fetch: opts.fetchImpl,
    throwOnError: false,
  }

  return createClient(config)
}

function unwrapOrThrow(result: any) {
  if (result?.error !== undefined) {
    const statusCode = result?.response?.status ?? 500
    throw toHandshakeApiError(statusCode, result.error as ErrorResponse)
  }
  return result?.data
}

export class HandshakeClient {
  private client: GeneratedClient

  constructor(opts: HandshakeClientOptions) {
    this.client = buildGeneratedClient(opts)
  }

  workflow = {
    submitRequest: async (payload: SubmitWorkflowRequestData['body']) => {
      const result = await submitWorkflowRequest({ client: this.client, body: payload })
      return unwrapOrThrow(result)
    },

    getRequest: async (requestId: string, identityEnvelope: IdentityEnvelope) => {
      const result = await getWorkflowRequest({
        client: this.client,
        path: { requestId },
        headers: { 'x-identity-envelope': jsonHeader(identityEnvelope) },
      })
      return unwrapOrThrow(result)
    },

    getDecisionRoom: async (requestId: string, identityEnvelope: IdentityEnvelope) => {
      const result = await getDecisionRoom({
        client: this.client,
        path: { requestId },
        headers: { 'x-identity-envelope': jsonHeader(identityEnvelope) },
      })
      return unwrapOrThrow(result)
    },

    resolveAction: async (
      payload: DecisionActionInput,
      identityEnvelope: IdentityEnvelope,
      idempotencyKey?: string,
    ) => {
      const data: ResolveDecisionActionData = {
        url: '/workflow/decision-room/action',
        body: payload,
        headers: {
          ...(idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {}),
        },
      }

      const result = await resolveDecisionAction({
        client: this.client,
        ...data,
        headers: {
          ...data.headers,
          'x-identity-envelope': jsonHeader(identityEnvelope),
        },
      })

      return unwrapOrThrow(result)
    },

    evidence: async (requestId: string, identityEnvelope: IdentityEnvelope) => {
      const result = await getWorkflowEvidence({
        client: this.client,
        path: { requestId },
        headers: { 'x-identity-envelope': jsonHeader(identityEnvelope) },
      })
      return unwrapOrThrow(result)
    },
  }

  policy = {
    config: async (scope?: PolicyScope, scopeId?: string) => {
      const query: GetPolicyConfigData['query'] = {
        ...(scope ? { scope } : {}),
        ...(scopeId ? { scopeId } : {}),
      }
      const result = await getPolicyConfig({ client: this.client, query })
      return unwrapOrThrow(result)
    },

    simulate: async (payload: PolicyApplyInput) => {
      const result = await simulatePolicy({ client: this.client, body: payload })
      return unwrapOrThrow(result)
    },

    apply: async (
      payload: ApplyPolicyData['body'],
      identityEnvelope: IdentityEnvelope,
      internalTrustToken: string | InternalTrustTokenProvider,
    ) => {
      const token = typeof internalTrustToken === 'function' ? internalTrustToken() : internalTrustToken

      const result = await applyPolicy({
        client: this.client,
        body: payload,
        headers: {
          'x-identity-envelope': jsonHeader(identityEnvelope),
          'x-internal-trust-context': token,
        },
      })
      return unwrapOrThrow(result)
    },
  }

  agents = {
    list: async () => {
      const result = await listAgents({ client: this.client })
      return unwrapOrThrow(result)
    },

    get: async (agentId: string) => {
      const result = await getAgent({ client: this.client, path: { agentId } })
      return unwrapOrThrow(result)
    },
  }

  entities = {
    list: async () => {
      const result = await listEntities({ client: this.client })
      return unwrapOrThrow(result)
    },

    get: async (entityId: string) => {
      const result = await getEntity({ client: this.client, path: { entityId } })
      return unwrapOrThrow(result)
    },
  }
}
