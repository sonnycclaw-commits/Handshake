import { CredentialType } from '../value-objects/credential-type'
import { CredentialId } from '../value-objects/credential-id'
import { Tier } from '../value-objects/tier'
import { Manifest, CredentialRef } from '../entities/manifest'
import { CURRENT_VERSION } from '../constants/manifest-version'
import { ValidationError, ManifestError, SecurityError, ErrorCode } from '../errors'

const MAX_CREDENTIALS = 1000
const MAX_MANIFEST_BYTES = 1_000_000
const MAX_ID_LENGTH = 256
const MAX_DEPTH = 10
const FUTURE_TOLERANCE_MS = 2 * 60 * 1000

const isValidUtf8 = (value: string): boolean => {
  try {
    const encoded = new TextEncoder().encode(value)
    const decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(encoded)
    return decoded === value
  } catch {
    return false
  }
}

const hasInvalidBidi = (value: string): boolean => /[\u202E\u202D\u202A\u202B\u202C]/.test(value)
const hasHomograph = (value: string): boolean => /[\u0400-\u04FF]/.test(value)

const validateDepth = (value: any, depth = 1, seen = new Set<any>()): void => {
  if (value === null || typeof value !== 'object') return
  if (seen.has(value)) throw new ValidationError('Circular reference detected', ErrorCode.MANIFEST_INVALID_FORMAT)
  if (depth > MAX_DEPTH) throw new ValidationError('Manifest too deep', ErrorCode.MANIFEST_INVALID_FORMAT)
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((item) => validateDepth(item, depth + 1, seen))
  } else {
    Object.values(value).forEach((child) => validateDepth(child, depth + 1, seen))
  }
  seen.delete(value)
}

export const createManifest = (input: any): Manifest => {
  if (!input || typeof input !== 'object') {
    throw new ManifestError('Invalid manifest input', ErrorCode.MANIFEST_INVALID_FORMAT)
  }

  // Required field validation with clear messages
  if (!input.agentId) {
    throw new ValidationError('agentId is required', ErrorCode.MANIFEST_MISSING_FIELD, { field: 'agentId' })
  }
  if (!input.principalId) {
    throw new ValidationError('principalId is required', ErrorCode.MANIFEST_MISSING_FIELD, { field: 'principalId' })
  }
  if (!input.credentials || !Array.isArray(input.credentials) || input.credentials.length === 0) {
    throw new ValidationError('credentials array is required and must not be empty', ErrorCode.MANIFEST_MISSING_FIELD, { field: 'credentials', expectedFormat: 'array of credential objects' })
  }

  // Type validation
  if (typeof input.createdAt !== 'number') {
    throw new ValidationError('createdAt must be a number', ErrorCode.MANIFEST_INVALID_FORMAT, { field: 'createdAt', expectedFormat: 'timestamp' })
  }
  if (typeof input.expiresAt !== 'number') {
    throw new ValidationError('expiresAt must be a number', ErrorCode.MANIFEST_INVALID_FORMAT, { field: 'expiresAt', expectedFormat: 'timestamp' })
  }

  // Timestamp validation
  if (input.expiresAt <= input.createdAt) {
    throw new ValidationError('expiresAt must be after createdAt', ErrorCode.MANIFEST_INVALID_FORMAT, { field: 'expiresAt' })
  }
  if (input.expiresAt <= Date.now() && input.expiresAt > input.createdAt) {
    throw new ValidationError('expiresAt must be in the future', ErrorCode.MANIFEST_INVALID_FORMAT, { field: 'expiresAt' })
  }
  if (input.createdAt - Date.now() > FUTURE_TOLERANCE_MS) {
    throw new ValidationError('createdAt cannot be more than 2 minutes in the future', ErrorCode.MANIFEST_INVALID_FORMAT, { field: 'createdAt' })
  }

  // Version validation
  if (input.version === undefined) {
    throw new ValidationError('version is required', ErrorCode.MANIFEST_MISSING_FIELD, { field: 'version', expectedFormat: 'string (e.g., "1.0")' })
  }
  if (typeof input.version !== 'string') {
    throw new ValidationError('version must be a string', ErrorCode.MANIFEST_INVALID_FORMAT, { field: 'version', expectedFormat: 'string (e.g., "1.0")' })
  }
  if (input.version !== CURRENT_VERSION) {
    throw new ValidationError(`Invalid manifest version: expected ${CURRENT_VERSION}, got ${input.version}`, ErrorCode.MANIFEST_INVALID_FORMAT, { field: 'version' })
  }

  // Size validation
  if (input.agentId.length > MAX_ID_LENGTH) {
    throw new ValidationError(`agentId exceeds maximum length of ${MAX_ID_LENGTH}`, ErrorCode.MANIFEST_INVALID_FORMAT, { field: 'agentId' })
  }
  if (input.principalId.length > MAX_ID_LENGTH) {
    throw new ValidationError(`principalId exceeds maximum length of ${MAX_ID_LENGTH}`, ErrorCode.MANIFEST_INVALID_FORMAT, { field: 'principalId' })
  }

  validateDepth(input)

  const manifestSize = new TextEncoder().encode(JSON.stringify(input)).length
  if (manifestSize > MAX_MANIFEST_BYTES) {
    throw new ManifestError(`Manifest exceeds maximum size of ${MAX_MANIFEST_BYTES} bytes`, ErrorCode.MANIFEST_INVALID_FORMAT)
  }

  if (input.credentials.length > MAX_CREDENTIALS) {
    throw new ManifestError(`Manifest exceeds maximum of ${MAX_CREDENTIALS} credentials`, ErrorCode.MANIFEST_INVALID_FORMAT)
  }

  // Credential validation
  const credentialRefs: CredentialRef[] = input.credentials.map((credential: any, index: number) => {
    try {
      const name = credential.name
      if (typeof name === 'string') {
        if (!isValidUtf8(name)) {
          throw new ValidationError('Invalid UTF-8 encoding in credential name', ErrorCode.MANIFEST_INVALID_FORMAT, { field: `credentials[${index}].name` })
        }
        if (hasInvalidBidi(name)) {
          throw new SecurityError('Invalid bidi override in credential name', ErrorCode.SECURITY_VIOLATION, { field: `credentials[${index}].name` })
        }
        const normalized = name.normalize('NFC')
        if (hasHomograph(normalized)) {
          throw new SecurityError('Potential homograph attack in credential name', ErrorCode.SECURITY_VIOLATION, { field: `credentials[${index}].name` })
        }
        credential.name = normalized
      }

      return {
        type: CredentialType.from(credential.type),
        id: CredentialId.from(credential.id),
        tier: Tier.from(credential.tier),
        ...(credential.name ? { name: credential.name } : {})
      }
    } catch (err: any) {
      // Re-throw typed errors
      if (err instanceof ValidationError || err instanceof SecurityError) {
        throw err
      }
      // Wrap other errors
      const message = err?.message || 'Invalid credential'
      if (/credential type/.test(message)) {
        throw new ValidationError('Invalid credential type', ErrorCode.MANIFEST_INVALID_CREDENTIAL, { field: `credentials[${index}].type`, path: ['credentials', String(index), 'type'], expectedFormat: 'payment_method, api_key, identity_document, or email' })
      }
      if (/credential id/.test(message)) {
        throw new ValidationError('Invalid credential id format', ErrorCode.MANIFEST_INVALID_CREDENTIAL, { field: `credentials[${index}].id`, expectedFormat: 'string matching pattern cred[a-zA-Z0-9_]*' })
      }
      throw new ValidationError('Invalid credential', ErrorCode.MANIFEST_INVALID_CREDENTIAL, { field: `credentials[${index}]` })
    }
  })

  return new Manifest(
    input.agentId,
    input.principalId,
    credentialRefs,
    input.createdAt,
    input.expiresAt,
    input.version
  )
}
