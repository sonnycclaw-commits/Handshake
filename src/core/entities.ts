export type EntityTrustState = 'established' | 'watch' | 'restricted' | 'unknown'
export type EntityStatus = 'active' | 'restricted' | 'suspended' | 'archived'

export type EntityRow = {
  entity_id: string
  entity_type: string
  display_name: string
  legal_name?: string | null
  owner_principal_id: string
  status: EntityStatus
  trust_state: EntityTrustState
  exposure_score: number
  created_at: number
  updated_at: number
}

export function normalizeEntityType(value: unknown): string {
  const raw = String(value ?? '').trim()
  return raw.length > 0 ? raw : 'other'
}

export function normalizeEntityStatus(value: unknown): EntityStatus {
  const v = String(value ?? '').toLowerCase()
  if (v === 'active' || v === 'restricted' || v === 'suspended' || v === 'archived') return v
  return 'active'
}

export function normalizeEntityTrustState(value: unknown): EntityTrustState {
  const v = String(value ?? '').toLowerCase()
  if (v === 'established' || v === 'watch' || v === 'restricted' || v === 'unknown') return v
  return 'unknown'
}
