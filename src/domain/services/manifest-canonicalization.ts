import canonicalize from 'canonicalize'
import { Manifest } from '../entities/manifest'
import { CredentialType } from '../value-objects/credential-type'
import { CredentialId } from '../value-objects/credential-id'
import { Tier } from '../value-objects/tier'


const TYPE_ORDER: Record<string, number> = {
  payment_method: 1,
  identity_document: 2,
  api_key: 3,
  email: 4,
  calendar: 5,
  read_only: 6,
  weather_api: 7
}

const ensureJsonSafe = (value: any, seen = new Set<any>()): void => {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    throw new Error('Non-JSON-safe value')
  }
  if (value === null) return
  if (typeof value !== 'object') return
  if (seen.has(value)) {
    throw new Error('Circular structure')
  }
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) ensureJsonSafe(item, seen)
  } else {
    for (const item of Object.values(value)) ensureJsonSafe(item, seen)
  }
  seen.delete(value)
}

export const canonicalizeManifest = (manifest: Manifest): Uint8Array => {
  const raw: any = manifest as any
  const agentId = raw.agentId ?? raw.agent_id
  const principalId = raw.principalId ?? raw.principal_id
  const createdAt = raw.createdAt ?? raw.created_at
  const expiresAt = raw.expiresAt ?? raw.expires_at
  const rawCredentials = raw.credentials ?? []

  if (agentId === undefined || principalId === undefined) {
    throw new Error('Invalid manifest for canonicalization')
  }
  const rawCredentialsSorted = Array.isArray(rawCredentials) ? [...rawCredentials].sort((a, b) => {
    const aType = (a?.type instanceof CredentialType) ? a.type.value : (a?.type?.value ?? String(a?.type))
    const bType = (b?.type instanceof CredentialType) ? b.type.value : (b?.type?.value ?? String(b?.type))
    const aOrder = TYPE_ORDER[aType] ?? 999
    const bOrder = TYPE_ORDER[bType] ?? 999
    if (aOrder !== bOrder) return aOrder - bOrder
    if (aType !== bType) return aType < bType ? -1 : 1
    const aId = (a?.id instanceof CredentialId) ? a.id.value : (a?.id?.value ?? String(a?.id))
    const bId = (b?.id instanceof CredentialId) ? b.id.value : (b?.id?.value ?? String(b?.id))
    if (aId !== bId) return aId < bId ? -1 : 1
    const aTier = (a?.tier instanceof Tier) ? a.tier.level : (a?.tier?.level ?? 0)
    const bTier = (b?.tier instanceof Tier) ? b.tier.level : (b?.tier?.level ?? 0)
    return aTier - bTier
  }) : []
  const credentials = rawCredentialsSorted
    .map((credential) => ({
      type: credential.type instanceof CredentialType ? credential.type.value : (credential.type as any)?.value ?? String(credential.type),
      id: credential.id instanceof CredentialId ? credential.id.value : (credential.id as any)?.value ?? String(credential.id),
      tier: {
        level: credential.tier instanceof Tier ? credential.tier.level : (credential.tier as any)?.level,
        name: credential.tier instanceof Tier ? credential.tier.name : (credential.tier as any)?.name
      }
    }))

  const payload = {
    agentId,
    principalId,
    credentials,
    createdAt,
    expiresAt,
    ...(manifest as any).version ? { version: (manifest as any).version } : {}
  }

  ensureJsonSafe(payload)
  const canonical = canonicalize(payload)
  if (canonical === undefined) {
    throw new Error('Invalid manifest for canonicalization')
  }
  return new TextEncoder().encode(canonical)
}