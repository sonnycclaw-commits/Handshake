/**
 * Response Sanitization Service
 *
 * Removes sensitive data from responses before returning to callers.
 * Implements D006: Response Sanitization Mandatory.
 *
 * @module domain/services/response-sanitization
 */

const CARD_PATTERN = /\b\d{13,19}\b/g
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g
const PASSPORT_PATTERN = /\bZZ\d{7}\b/g
const DOB_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/g
const ADDRESS_PATTERN = /\b\d+\s+[A-Za-z]+\s+(St|Street|Rd|Road|Ave|Avenue|Blvd|Boulevard|Ln|Lane|Dr|Drive)\b/gi

const SCRIPT_PATTERN = /<script\b[^>]*>[\s\S]*?<\/script>/gi
const PATH_TRAVERSAL_PATTERN = /\.\.\/[\w./-]*/g
const ABSOLUTE_PATH_PATTERN = /\/(?:home|Users|var|etc|opt|srv)\/[\w./-]*/g
const SQLI_PATTERN = /";\s*DROP\s+TABLE[\s\S]*$/gi
const SECRET_ASSIGNMENT_PATTERN = /\b(password|secret|token|api[_-]?key)\s*[:=]\s*[^\s\n]+/gi
const DB_INTERNAL_PATTERN = /\b\w*Connection\.\w+\b/g

const SENSITIVE_KEY_PATTERN = /(card|ssn|passport|dob|date[_-]?of[_-]?birth|address|last[_-]?four|first[_-]?six|part\d+|cvv|expiry|number|sensitive|malicious|secret|token|key)/i

const UNICODE_DIGIT_MAP: Record<string, string> = {
  '\u2080': '0','\u2081': '1','\u2082': '2','\u2083': '3','\u2084': '4','\u2085': '5','\u2086': '6','\u2087': '7','\u2088': '8','\u2089': '9',
  '\uFF10': '0','\uFF11': '1','\uFF12': '2','\uFF13': '3','\uFF14': '4','\uFF15': '5','\uFF16': '6','\uFF17': '7','\uFF18': '8','\uFF19': '9',
  '\u0660': '0','\u0661': '1','\u0662': '2','\u0663': '3','\u0664': '4','\u0665': '5','\u0666': '6','\u0667': '7','\u0668': '8','\u0669': '9'
}

function normalizeDigits(value: string): string {
  let out = ''
  for (const ch of value) out += UNICODE_DIGIT_MAP[ch] ?? ch
  return out
}

function likelyEncodedSensitive(value: string): boolean {
  const candidates: string[] = []

  try {
    if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length % 4 === 0) {
      const decoded = Buffer.from(value, 'base64').toString('utf8')
      if (decoded) candidates.push(decoded)
    }
  } catch {}

  try {
    if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
      const decoded = Buffer.from(value, 'hex').toString('utf8')
      if (decoded) candidates.push(decoded)
    }
  } catch {}

  try {
    const decoded = decodeURIComponent(value)
    if (decoded !== value) candidates.push(decoded)
  } catch {}

  return candidates.some(c => containsSensitivePattern(c))
}

function containsSensitivePattern(input: string): boolean {
  resetRegexState()

  const normalized = normalizeDigits(input)
  const compact = normalized.replace(/\s+/g, '')
  const digitsOnly = compact.replace(/\D/g, '')
  const reversed = compact.split('').reverse().join('')

  return (
    CARD_PATTERN.test(compact) ||
    CARD_PATTERN.test(normalized) ||
    CARD_PATTERN.test(reversed) ||
    SSN_PATTERN.test(normalized) ||
    PASSPORT_PATTERN.test(normalized) ||
    DOB_PATTERN.test(normalized) ||
    ADDRESS_PATTERN.test(normalized) ||
    SCRIPT_PATTERN.test(normalized) ||
    PATH_TRAVERSAL_PATTERN.test(normalized) ||
    ABSOLUTE_PATH_PATTERN.test(normalized) ||
    SECRET_ASSIGNMENT_PATTERN.test(normalized) ||
    DB_INTERNAL_PATTERN.test(normalized) ||
    digitsOnly.length >= 13
  )
}

function resetRegexState(): void {
  CARD_PATTERN.lastIndex = 0
  SSN_PATTERN.lastIndex = 0
  PASSPORT_PATTERN.lastIndex = 0
  DOB_PATTERN.lastIndex = 0
  ADDRESS_PATTERN.lastIndex = 0
  SCRIPT_PATTERN.lastIndex = 0
  PATH_TRAVERSAL_PATTERN.lastIndex = 0
  ABSOLUTE_PATH_PATTERN.lastIndex = 0
  SQLI_PATTERN.lastIndex = 0
  SECRET_ASSIGNMENT_PATTERN.lastIndex = 0
  DB_INTERNAL_PATTERN.lastIndex = 0
}

function redactString(text: string): string {
  resetRegexState()

  let value = text
    .replace(SCRIPT_PATTERN, '[REDACTED]')
    .replace(PATH_TRAVERSAL_PATTERN, '[REDACTED]')
    .replace(ABSOLUTE_PATH_PATTERN, '[REDACTED]')
    .replace(SECRET_ASSIGNMENT_PATTERN, '[REDACTED]')
    .replace(DB_INTERNAL_PATTERN, '[REDACTED]')
    .replace(SQLI_PATTERN, '[REDACTED]')

  // if encoded/obfuscated content likely hides sensitive data, replace whole value
  if (likelyEncodedSensitive(value) || containsSensitivePattern(value)) {
    return '[REDACTED]'
  }

  value = value
    .replace(CARD_PATTERN, '[REDACTED]')
    .replace(SSN_PATTERN, '[REDACTED]')
    .replace(PASSPORT_PATTERN, '[REDACTED]')
    .replace(DOB_PATTERN, '[REDACTED]')
    .replace(ADDRESS_PATTERN, '[REDACTED]')

  return value
}

function shouldRedactAsCardFragmentGroup(obj: Record<string, unknown>): Set<string> {
  const fragmentKeys = new Set<string>()
  const fragments: string[] = []

  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== 'string') continue
    const digits = normalizeDigits(v).replace(/\D/g, '')
    if (digits.length >= 3 && digits.length <= 6) {
      fragmentKeys.add(k)
      fragments.push(digits)
    }
  }

  if (fragments.length < 3) return new Set<string>()

  const totalLength = fragments.reduce((sum, f) => sum + f.length, 0)
  if (totalLength >= 13) return fragmentKeys

  return new Set<string>()
}

function redactValue(value: unknown, keyHint?: string, depth = 0, seen = new WeakMap<object, any>()): unknown {
  if (depth > 1000) return '[MaxDepth]'
  if (value === null || value === undefined) return value

  if (typeof value === 'string') {
    if (keyHint && SENSITIVE_KEY_PATTERN.test(keyHint)) return '[REDACTED]'
    return redactString(value)
  }

  if (typeof value === 'number') {
    // preserve ordinary numbers, redact number-like credentials
    const asString = String(value)
    if (/^\d{13,19}$/.test(asString)) return 0
    return value
  }

  if (typeof value === 'boolean') return value
  if (typeof value === 'function') return '[Function]'
  if (typeof value === 'symbol') return '[Symbol]'

  if (Array.isArray(value)) {
    const out: unknown[] = []
    for (const item of value) out.push(redactValue(item, keyHint, depth + 1, seen))
    return out
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[Circular]'

    // Errors have non-enumerable fields we still need (message/stack)
    if (value instanceof Error) {
      const out: Record<string, unknown> = {
        name: value.name,
        message: redactString(value.message),
        stack: value.stack ? redactString(value.stack) : '[REDACTED]'
      }
      seen.set(value, out)

      // include enumerable custom props (code, metadata, etc.)
      for (const [k, v] of Object.entries(value as unknown as Record<string, unknown>)) {
        out[k] = redactValue(v, k, depth + 1, seen)
      }
      return out
    }

    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    seen.set(value as object, out)

    const groupedFragmentKeys = shouldRedactAsCardFragmentGroup(source)

    for (const [k, v] of Object.entries(source)) {
      if (groupedFragmentKeys.has(k)) {
        out[k] = '[REDACTED]'
        continue
      }
      out[k] = redactValue(v, k, depth + 1, seen)
    }
    return out
  }

  return value
}

export function sanitizeResponse(response: unknown, _options?: { detectEntropy?: boolean }): unknown {
  return redactValue(response)
}

export function sanitizeError(error: Error): Error {
  const sanitized = new Error(redactString(error.message))
  sanitized.name = error.name
  ;(sanitized as any).code = (error as any).code
  ;(sanitized as any).stack = error.stack ? redactString(error.stack) : '[REDACTED]'

  for (const [k, v] of Object.entries(error as unknown as Record<string, unknown>)) {
    ;(sanitized as any)[k] = redactValue(v, k)
  }

  if ((error as any).cause) {
    ;(sanitized as any).cause = sanitizeError((error as any).cause)
  }

  return sanitized
}
