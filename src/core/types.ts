export type Bindings = {
  DB: D1Database
  KV: KVNamespace
  ENVIRONMENT: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  JWT_PRIVATE_KEY: string
  JWT_PUBLIC_KEY: string
  JWT_KEY_ID: string
  IDENTITY_PROVIDER?: 'legacy' | 'clerk'
  CLERK_JWT_KEY?: string
  CLERK_SECRET_KEY?: string
  CLERK_AUDIENCE?: string
  CLERK_AUTHORIZED_PARTIES?: string
  INTERNAL_TRUST_SHARED_SECRET?: string
}

export type InternalTrustContext = {
  iss: 'handshake-edge'
  aud: 'handshake-core'
  sub: 'policy.apply'
  iat: number
  exp: number
  jti: string
  principalId?: string
  traceId?: string
}

export type AppEnv = {
  Bindings: Bindings
  Variables: {
    identityEnvelope?: {
      principalId: string
      subjectType: 'human' | 'service' | 'agent'
      roles: string[]
      scopes: string[]
      issuer?: string
      sessionId?: string
      tenantId?: string
    }
    internalTrustContext?: InternalTrustContext
    workflowServices?: {
      requestWorkflowService: import('../domain/services/request-workflow.service.types').RequestWorkflowService
    }
  }
}
