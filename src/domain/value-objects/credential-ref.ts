import { CredentialType } from './credential-type'
import { CredentialId } from './credential-id'
import { Tier } from './tier'

export interface CredentialRef {
  type: CredentialType
  id: CredentialId
  tier: Tier
  name?: string
}
