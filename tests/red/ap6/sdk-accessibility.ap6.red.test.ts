import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('AP6 W4 RED — SDK accessibility', () => {
  it('requires generated TypeScript SDK package scaffold', () => {
    const sdkPkg = resolve(process.cwd(), 'sdk/typescript/package.json')
    expect(existsSync(sdkPkg)).toBe(true)
  })

  it('requires generated SDK outputs from OpenAPI contract', () => {
    const generatedSdk = resolve(process.cwd(), 'sdk/typescript/generated/sdk.gen.ts')
    const generatedTypes = resolve(process.cwd(), 'sdk/typescript/generated/types.gen.ts')

    expect(existsSync(generatedSdk)).toBe(true)
    expect(existsSync(generatedTypes)).toBe(true)

    const sdkContent = readFileSync(generatedSdk, 'utf8')
    const typesContent = readFileSync(generatedTypes, 'utf8')

    expect(sdkContent.includes('submitWorkflowRequest')).toBe(true)
    expect(sdkContent.includes('resolveDecisionAction')).toBe(true)
    expect(sdkContent.includes('applyPolicy')).toBe(true)

    expect(typesContent.includes("export type ResponseClass = 'ok' | 'retryable' | 'blocked' | 'unknown'"))
  })

  it('requires ergonomic wrapper surface for core rails', () => {
    const wrapperPath = resolve(process.cwd(), 'sdk/typescript/src/handshake-client.ts')
    const exists = existsSync(wrapperPath)
    expect(exists).toBe(true)

    const content = readFileSync(wrapperPath, 'utf8')
    expect(content.includes('workflow')).toBe(true)
    expect(content.includes('submitRequest')).toBe(true)
    expect(content.includes('resolveAction')).toBe(true)

    expect(content.includes('policy')).toBe(true)
    expect(content.includes('simulate')).toBe(true)
    expect(content.includes('apply')).toBe(true)

    expect(content.includes('agents')).toBe(true)
    expect(content.includes('entities')).toBe(true)
  })

  it('requires SDK error normalization contract', () => {
    const errorsPath = resolve(process.cwd(), 'sdk/typescript/src/errors.ts')
    const exists = existsSync(errorsPath)
    expect(exists).toBe(true)

    const content = readFileSync(errorsPath, 'utf8')
    expect(content.includes('reasonCode')).toBe(true)
    expect(content.includes('responseClass')).toBe(true)
    expect(content.includes('retryable')).toBe(true)
    expect(content.includes("'ok' | 'retryable' | 'blocked' | 'unknown'"))
  })

  it('requires quickstart smoke harness', () => {
    const smokePath = resolve(process.cwd(), 'sdk/typescript/tests/quickstart.smoke.test.ts')
    expect(existsSync(smokePath)).toBe(true)
  })
})
