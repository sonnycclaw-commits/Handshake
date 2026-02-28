export type CredentialIdValue = string

export class CredentialId {
  public readonly value: CredentialIdValue

  private constructor(value: CredentialIdValue) {
    this.value = value
    Object.freeze(this)
  }

  static from(input: unknown): CredentialId {
    if (typeof input !== 'string') {
      throw new Error('Invalid credential id')
    }

    const normalized = input.trim()
    if (!normalized) {
      throw new Error('Invalid credential id')
    }

    return new CredentialId(normalized)
  }

  equals(other: CredentialId): boolean {
    return this.value === other.value
  }
}
