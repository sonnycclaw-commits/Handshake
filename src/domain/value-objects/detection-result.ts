import { SensitiveDataPattern } from './sensitive-data-pattern'

const PATTERN_REGEX: Record<SensitiveDataPattern, RegExp> = {
  [SensitiveDataPattern.CARD_NUMBER]: /\b\d{13,19}\b/g,
  [SensitiveDataPattern.SSN]: /\b\d{3}-\d{2}-\d{4}\b/g,
  [SensitiveDataPattern.PASSPORT]: /\bZZ\d{7}\b/g,
  [SensitiveDataPattern.DATE_OF_BIRTH]: /\b\d{4}-\d{2}-\d{2}\b/g,
  [SensitiveDataPattern.ADDRESS]: /\b\d+\s+[A-Za-z]+\s+(St|Street|Rd|Road|Ave|Avenue|Blvd|Boulevard|Ln|Lane|Dr|Drive)\b/gi
}

const normalizeDigits = (value: string): string => {
  const unicodeDigits: Record<string, string> = {
    '\u2080': '0','\u2081': '1','\u2082': '2','\u2083': '3','\u2084': '4','\u2085': '5','\u2086': '6','\u2087': '7','\u2088': '8','\u2089': '9',
    '\uFF10': '0','\uFF11': '1','\uFF12': '2','\uFF13': '3','\uFF14': '4','\uFF15': '5','\uFF16': '6','\uFF17': '7','\uFF18': '8','\uFF19': '9',
    '\u0660': '0','\u0661': '1','\u0662': '2','\u0663': '3','\u0664': '4','\u0665': '5','\u0666': '6','\u0667': '7','\u0668': '8','\u0669': '9'
  }
  let out = ''
  for (const ch of value) {
    out += unicodeDigits[ch as keyof typeof unicodeDigits] ?? ch
  }
  return out
}

const decodeIfEncoded = (value: string): string[] => {
  const results: string[] = []
  // base64
  try {
    if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length % 4 === 0) {
      const buf = Buffer.from(value, 'base64')
      const decoded = buf.toString('utf8')
      if (decoded && /[\d]/.test(decoded)) results.push(decoded)
    }
  } catch {}
  // hex
  try {
    if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
      const buf = Buffer.from(value, 'hex')
      const decoded = buf.toString('utf8')
      if (decoded && /[\d]/.test(decoded)) results.push(decoded)
    }
  } catch {}
  // url
  try {
    const decoded = decodeURIComponent(value)
    if (decoded !== value) results.push(decoded)
  } catch {}
  return results
}

const hasPatternInString = (value: string, pattern: SensitiveDataPattern): boolean => {
  const normalized = normalizeDigits(value)
  const compact = normalized.replace(/\s+/g, '')
  const reversed = compact.split('').reverse().join('')

  const regex = PATTERN_REGEX[pattern]
  if (regex.test(compact)) return true
  if (regex.test(normalized)) return true
  if (regex.test(reversed)) return true

  const decodedVariants = decodeIfEncoded(value)
  for (const decoded of decodedVariants) {
    if (regex.test(decoded)) return true
    const decodedNormalized = normalizeDigits(decoded)
    if (regex.test(decodedNormalized)) return true
  }

  return false
}

const scan = (input: any, patterns = Object.values(SensitiveDataPattern)): { direct: Set<SensitiveDataPattern>; obfuscated: Set<SensitiveDataPattern> } => {
  const found = new Set<SensitiveDataPattern>()
  const obfuscated = new Set<SensitiveDataPattern>()
  const seen = new Set<any>()
  const stack: any[] = [input]

  while (stack.length) {
    const current = stack.pop()
    if (current === null || current === undefined) continue

    if (typeof current === 'string') {
      for (const pattern of patterns) {
        if (hasPatternInString(current, pattern)) found.add(pattern)
      }
      // obfuscated detection: strip non-digits
      const stripped = current.replace(/[^\d]/g, '')
      if (stripped.length >= 13) {
        obfuscated.add(SensitiveDataPattern.CARD_NUMBER)
      }
      continue
    }

    if (typeof current === 'number' || typeof current === 'boolean') {
      const str = String(current)
      for (const pattern of patterns) {
        if (hasPatternInString(str, pattern)) found.add(pattern)
      }
      continue
    }

    if (typeof current !== 'object') continue

    if (seen.has(current)) continue
    seen.add(current)

    if (Array.isArray(current)) {
      for (const item of current) stack.push(item)
      continue
    }

    for (const value of Object.values(current)) {
      stack.push(value)
    }
  }

  return { direct: found, obfuscated }
}

export class DetectionResult {
  private readonly patterns: Set<SensitiveDataPattern>
  private readonly obfuscated: Set<SensitiveDataPattern>

  private constructor(patterns: Set<SensitiveDataPattern>, obfuscated: Set<SensitiveDataPattern>) {
    this.patterns = patterns
    this.obfuscated = obfuscated
  }

  static analyze(input: any): DetectionResult {
    const result = scan(input)
    return new DetectionResult(result.direct, result.obfuscated)
  }

  hasPattern(pattern: SensitiveDataPattern): boolean {
    return this.patterns.has(pattern)
  }

  hasEncodedPattern(pattern: SensitiveDataPattern): boolean {
    return this.patterns.has(pattern)
  }

  hasObfuscatedPattern(pattern: SensitiveDataPattern): boolean {
    return this.obfuscated.has(pattern)
  }
}
