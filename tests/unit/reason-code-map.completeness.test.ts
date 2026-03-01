import { describe, it, expect } from 'vitest'
import { assertReasonCodeStatusMapComplete } from '@/domain/constants/reason-code-http'

describe('reason-code status map completeness', () => {
  it('covers all known reason codes', () => {
    expect(() => assertReasonCodeStatusMapComplete()).not.toThrow()
  })
})
