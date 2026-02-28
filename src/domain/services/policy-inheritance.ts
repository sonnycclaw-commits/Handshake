import { invalidInput } from '../errors/governance-errors'

type PolicyShape = {
  maxTransaction?: number
  dailySpendLimit?: number
  allowedHours?: string
  allowedCategories?: string[]
}

type ResolvePolicyInheritanceInput = {
  parent: PolicyShape
  child: PolicyShape
}

function finiteOrUndefined(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function stricterMin(a?: number, b?: number): number | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  return Math.min(a, b)
}

function intersectCategories(parent?: string[], child?: string[]): string[] | undefined {
  if (!Array.isArray(parent) && !Array.isArray(child)) return undefined
  if (!Array.isArray(parent)) return child
  if (!Array.isArray(child)) return parent
  const set = new Set(parent)
  return child.filter((c) => set.has(c))
}

export function resolvePolicyInheritance(input: ResolvePolicyInheritanceInput): PolicyShape {
  if (!input || typeof input !== 'object') throw invalidInput('object required')
  const parent = input.parent ?? {}
  const child = input.child ?? {}

  const resolved: PolicyShape = {
    maxTransaction: stricterMin(finiteOrUndefined(parent.maxTransaction), finiteOrUndefined(child.maxTransaction)),
    dailySpendLimit: stricterMin(finiteOrUndefined(parent.dailySpendLimit), finiteOrUndefined(child.dailySpendLimit)),
    allowedHours: child.allowedHours ?? parent.allowedHours,
    allowedCategories: intersectCategories(parent.allowedCategories, child.allowedCategories)
  }

  if (resolved.maxTransaction !== undefined && resolved.maxTransaction < 0) {
    throw invalidInput('maxTransaction must be >= 0', { field: 'maxTransaction' })
  }
  if (resolved.dailySpendLimit !== undefined && resolved.dailySpendLimit < 0) {
    throw invalidInput('dailySpendLimit must be >= 0', { field: 'dailySpendLimit' })
  }

  return resolved
}
