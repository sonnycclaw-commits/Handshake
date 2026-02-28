import { describe, it, expect } from 'vitest'
import * as errorCodes from '@/domain/errors/error-codes'

describe('Error Codes', () => {
  it('defines MANIFEST_INVALID_FIELDS error code', () => {
    expect((errorCodes as any).MANIFEST_INVALID_FIELDS).toBeDefined()
  })

  it('defines MANIFEST_EXPIRED error code', () => {
    expect((errorCodes as any).MANIFEST_EXPIRED).toBeDefined()
  })

  it('defines SIGNATURE_INVALID error code', () => {
    expect((errorCodes as any).SIGNATURE_INVALID).toBeDefined()
  })

  it('defines KEY_INVALID error code', () => {
    expect((errorCodes as any).KEY_INVALID).toBeDefined()
  })

  it('defines all error codes as constants', () => {
    expect(typeof (errorCodes as any).MANIFEST_INVALID_FIELDS).toBe('string')
    expect(typeof (errorCodes as any).MANIFEST_EXPIRED).toBe('string')
    expect(typeof (errorCodes as any).SIGNATURE_INVALID).toBe('string')
    expect(typeof (errorCodes as any).KEY_INVALID).toBe('string')
  })

  it('error codes are stable across versions', () => {
    expect(errorCodes).toMatchObject({
      MANIFEST_INVALID_FIELDS: 'MANIFEST_INVALID_FIELDS',
      MANIFEST_EXPIRED: 'MANIFEST_EXPIRED',
      SIGNATURE_INVALID: 'SIGNATURE_INVALID',
      KEY_INVALID: 'KEY_INVALID'
    })
  })
})
