export type CredentialTypeValue =
  | 'payment_method'
  | 'identity_document'
  | 'api_key'
  | 'email'
  | 'calendar'
  | 'read_only'
  | 'weather_api'

const ALLOWED_TYPES: ReadonlySet<CredentialTypeValue> = new Set([
  'payment_method',
  'identity_document',
  'api_key',
  'email',
  'calendar',
  'read_only',
  'weather_api'
])

export class CredentialType {
  public readonly value: CredentialTypeValue

  private constructor(value: CredentialTypeValue) {
    this.value = value
    Object.freeze(this)
  }

  static from(input: unknown): CredentialType {
    if (typeof input !== 'string') {
      throw new Error('Invalid credential type')
    }

    const normalized = input.trim()
    if (!normalized) {
      throw new Error('Invalid credential type')
    }

    if (!ALLOWED_TYPES.has(normalized as CredentialTypeValue)) {
      throw new Error('Invalid credential type')
    }

    return new CredentialType(normalized as CredentialTypeValue)
  }

  equals(other: CredentialType): boolean {
    return this.value === other.value
  }
}
