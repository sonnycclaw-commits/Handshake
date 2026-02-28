/**
 * Test Fixtures for Sensitive Data Handling
 * 
 * This module provides controlled generation of sensitive data for testing
 * sanitization and security controls. All data is synthetic and follows
 * real-world patterns without using actual sensitive information.
 */

/**
 * Test card data with support for major card types
 */
export interface TestCard {
  number: string
  type: 'visa' | 'mastercard' | 'amex'
  expiry: string
  cvv: string
}

/**
 * Test response builder for creating sanitization test cases
 */
export class TestResponseBuilder {
  private response: Record<string, any> = {}

  /**
   * Add a credit card to the test response
   */
  withCard(card: TestCard): TestResponseBuilder {
    this.response.card = {
      number: card.number,
      type: card.type,
      expiry: card.expiry,
      cvv: card.cvv
    }
    return this
  }

  /**
   * Add multiple credit cards to test bulk processing
   */
  withMultipleCards(count: number): TestResponseBuilder {
    this.response.cards = Array(count).fill(null).map(() => generateTestCard())
    return this
  }

  /**
   * Add an SSN to the test response
   */
  withSSN(ssn: string): TestResponseBuilder {
    this.response.ssn = ssn
    return this
  }

  /**
   * Add multiple SSNs to test bulk processing
   */
  withMultipleSSNs(count: number): TestResponseBuilder {
    this.response.ssns = Array(count).fill(null).map(() => generateTestSSN())
    return this
  }

  /**
   * Add a passport number to the test response
   */
  withPassport(passport: string): TestResponseBuilder {
    this.response.passport = passport
    return this
  }

  /**
   * Add multiple passports to test bulk processing
   */
  withMultiplePassports(count: number): TestResponseBuilder {
    this.response.passports = Array(count).fill(null).map(() => generateTestPassport())
    return this
  }

  /**
   * Add a custom field to the test response
   */
  withField(key: string, value: any): TestResponseBuilder {
    this.response[key] = value
    return this
  }

  /**
   * Get the built test response
   */
  build(): Record<string, any> {
    return { ...this.response }
  }
}

/**
 * Generate a valid test credit card number using Luhn algorithm
 */
export function generateTestCard(): TestCard {
  const types = ['visa', 'mastercard', 'amex'] as const
  const type = types[Math.floor(Math.random() * types.length)]

  // Generate valid card number for type
  let prefix: string
  let length: number
  switch (type) {
    case 'visa':
      prefix = '4'
      length = 16
      break
    case 'mastercard':
      prefix = '51'
      length = 16
      break
    case 'amex':
      prefix = '34'
      length = 15
      break
  }

  let number = prefix
  while (number.length < length - 1) {
    number += Math.floor(Math.random() * 10)
  }

  // Add Luhn check digit
  let sum = 0
  let isEven = false
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number[i])
    if (isEven) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    isEven = !isEven
  }
  const checkDigit = ((Math.floor(sum / 10) + 1) * 10 - sum) % 10
  number += checkDigit

  // Generate expiry and CVV
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')
  const year = String(new Date().getFullYear() + Math.floor(Math.random() * 5))
  const expiry = `${month}/${year}`
  const cvv = type === 'amex' 
    ? String(Math.floor(Math.random() * 1000)).padStart(4, '0')
    : String(Math.floor(Math.random() * 100)).padStart(3, '0')

  return { number, type, expiry, cvv }
}

/**
 * Generate a valid-format SSN for testing
 * Uses reserved prefix 666 to ensure it's never a real SSN
 */
export function generateTestSSN(): string {
  const group = String(Math.floor(Math.random() * 100)).padStart(2, '0')
  const serial = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `666-${group}-${serial}`
}

/**
 * Generate a valid-format passport number for testing
 * Uses reserved prefix ZZ to ensure it's never a real passport
 */
export function generateTestPassport(): string {
  const number = String(Math.floor(Math.random() * 10000000)).padStart(7, '0')
  return `ZZ${number}`
}

/**
 * Create a deeply nested object structure for testing
 */
export function createNestedStructure(depth: number, value: string): any {
  if (depth === 0) {
    return value
  }
  return {
    nested: createNestedStructure(depth - 1, value)
  }
}

/**
 * Create a response with mixed credential types and formats
 */
export function createMixedCredentialResponse(): Record<string, any> {
  return new TestResponseBuilder()
    .withCard(generateTestCard())
    .withSSN(generateTestSSN())
    .withPassport(generateTestPassport())
    .withField('date', new Date().toISOString())
    .withField('amount', 123.45)
    .build()
}

/**
 * Create a large response for performance testing
 */
export function createLargeResponse(cardCount: number): Record<string, any> {
  return new TestResponseBuilder()
    .withMultipleCards(cardCount)
    .withMultipleSSNs(cardCount)
    .withMultiplePassports(cardCount)
    .build()
}