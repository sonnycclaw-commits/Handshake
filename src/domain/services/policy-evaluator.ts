type PolicyInput = {
  dailySpendLimit?: number
  maxTransaction?: number
  allowedHours?: string
  allowedCategories?: string[]
}

type RequestInput = {
  amount?: number
  category?: string
  hour?: number
}

export type PolicyDecision = {
  decision: 'allow' | 'deny'
  tier: number
  requiresHITL: boolean
  reasons: string[]
}

function parseHourWindow(window: string): { start: number; end: number } | null {
  const m = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(window)
  if (!m) return null
  const start = Number(m[1])
  const end = Number(m[3])
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > 23 || end < 0 || end > 23) return null
  return { start, end }
}

function malformed(policy: PolicyInput): boolean {
  if (policy.maxTransaction !== undefined && !Number.isFinite(policy.maxTransaction)) return true
  if (policy.dailySpendLimit !== undefined && !Number.isFinite(policy.dailySpendLimit)) return true
  if (policy.allowedHours !== undefined && parseHourWindow(policy.allowedHours) === null) return true
  if (policy.allowedCategories !== undefined && !Array.isArray(policy.allowedCategories)) return true
  return false
}

export function evaluatePolicy(policy: PolicyInput, request: RequestInput): PolicyDecision {
  if (!policy || malformed(policy)) {
    return { decision: 'deny', tier: 4, requiresHITL: true, reasons: ['invalid_policy'] }
  }

  if (request.amount === undefined || request.amount === null) {
    return { decision: 'deny', tier: 4, requiresHITL: true, reasons: ['invalid_request'] }
  }

  const reasons: string[] = []
  const amount = Number(request.amount)
  const hour = request.hour
  const category = request.category

  if (!Number.isFinite(amount) || amount < 0) {
    return { decision: 'deny', tier: 4, requiresHITL: true, reasons: ['invalid_request'] }
  }

  if (policy.dailySpendLimit !== undefined && amount > policy.dailySpendLimit) {
    return { decision: 'deny', tier: 4, requiresHITL: true, reasons: ['daily_limit_exceeded'] }
  }

  if (policy.maxTransaction !== undefined && amount > policy.maxTransaction) {
    reasons.push('max_transaction_exceeded')
  }

  if (policy.allowedCategories && category && !policy.allowedCategories.includes(category)) {
    return { decision: 'deny', tier: 4, requiresHITL: true, reasons: ['category_not_allowed'] }
  }

  if (policy.allowedHours !== undefined && hour !== undefined) {
    const window = parseHourWindow(policy.allowedHours)
    if (!window || hour < window.start || hour > window.end) {
      return { decision: 'deny', tier: 4, requiresHITL: true, reasons: ['outside_allowed_hours'] }
    }
  }

  let tier = 1
  if (reasons.length > 0) {
    tier = 3
    if (policy.maxTransaction !== undefined && amount > policy.maxTransaction * 2) tier = 4
  }

  return {
    decision: 'allow',
    tier,
    requiresHITL: tier >= 3,
    reasons
  }
}
