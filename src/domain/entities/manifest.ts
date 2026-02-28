import { CredentialType } from '../value-objects/credential-type'
import { CredentialId } from '../value-objects/credential-id'
import { Tier } from '../value-objects/tier'

export interface CredentialRef {
  type: CredentialType
  id: CredentialId
  tier: Tier
  name?: string
}

const MIN_EXPIRY_WINDOW_MS = 1000
const MAX_CREDENTIALS = 100
const ID_PATTERN = /^[a-zA-Z0-9_]+$/
const CREDENTIAL_ID_PATTERN = /^cred[a-zA-Z0-9_]*$/

export class Manifest {
  public readonly agentId: string
  public readonly principalId: string
  public readonly credentials: CredentialRef[]
  public readonly createdAt: number
  public readonly expiresAt: number
  public readonly version?: string

  constructor(
    agentId: string,
    principalId: string,
    credentials: CredentialRef[],
    createdAt: number,
    expiresAt: number,
    version?: string
  ) {
    if (typeof agentId !== 'string' || !ID_PATTERN.test(agentId)) {
      throw new Error('Invalid agentId format')
    }

    if (typeof principalId !== 'string' || !ID_PATTERN.test(principalId)) {
      throw new Error('Invalid principalId format')
    }

    if (!Array.isArray(credentials) || credentials.length === 0) {
      throw new Error('Manifest must contain at least one credential')
    }

    if (credentials.length > MAX_CREDENTIALS) {
      throw new Error('Manifest exceeds maximum allowed credentials')
    }

    if (typeof createdAt !== 'number' || typeof expiresAt !== 'number') {
      throw new Error('Invalid manifest timestamps')
    }

    if (expiresAt < createdAt) {
      throw new Error('Invalid manifest timestamps: manifest cannot be created with past expiry')
    }

    if (expiresAt - createdAt < MIN_EXPIRY_WINDOW_MS) {
      throw new Error('Manifest expiry window must be at least 1 second')
    }

    for (const credential of credentials) {
      if (!credential || typeof credential !== 'object') {
        throw new Error('Invalid credential')
      }
      if (!(credential.type instanceof CredentialType)) {
        throw new Error('Invalid credential type')
      }
      let credValue: string | undefined
      if (credential.id instanceof CredentialId) {
        credValue = credential.id.value
      } else if (credential.id && typeof (credential.id as any).value === 'string') {
        credValue = String((credential.id as any).value)
      } else {
        throw new Error('Invalid credential id')
      }
      if (!CREDENTIAL_ID_PATTERN.test(credValue)) {
        throw new Error('Invalid credential ID format')
      }
      if (!(credential.tier instanceof Tier)) {
        throw new Error('Invalid credential tier')
      }
    }

    if (version !== undefined) {
      if (typeof version !== 'string') throw new Error('Invalid manifest version')
      this.version = version
    }

    this.agentId = agentId
    this.principalId = principalId
    this.credentials = credentials
    this.createdAt = createdAt
    this.expiresAt = expiresAt
  }

  isExpired(referenceTime: number = Date.now()): boolean {
    return referenceTime > this.expiresAt
  }

  hasCredential(type: CredentialType): boolean {
    if (!(type instanceof CredentialType)) return false
    return this.credentials.some((credential) => credential.type.equals(type))
  }

  getCredentialsByTier(level: number): CredentialRef[] {
    return this.credentials.filter((credential) => credential.tier.level === level)
  }

  getCredentialsByType(type: CredentialType): CredentialRef[] {
    if (!(type instanceof CredentialType)) return []
    return this.credentials.filter((credential) => credential.type.equals(type))
  }
}
