import canonicalize from 'canonicalize'

const ensureJsonSafe = (value: any, seen = new Set<any>()): void => {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    throw new Error('Non-JSON-safe value')
  }
  if (value === null) return
  if (typeof value !== 'object') return
  if (seen.has(value)) {
    throw new Error('Circular structure')
  }
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) ensureJsonSafe(item, seen)
  } else {
    for (const item of Object.values(value)) ensureJsonSafe(item, seen)
  }
  seen.delete(value)
}

export const canonicalizeObject = (value: any): string => {
  ensureJsonSafe(value)
  const canonical = canonicalize(value)
  if (canonical === undefined) throw new Error('Invalid input')
  return canonical
}
