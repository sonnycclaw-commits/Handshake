import { describe, it, expect } from 'vitest'
import type { VaultAdapter, VaultConfig, ExecutionContext, TransactionAction } from '@/ports/types'

type AdapterFactory<T extends VaultAdapter> = () => T

export function runVaultAdapterConformanceSuite<T extends VaultAdapter>(
  name: string,
  factory: AdapterFactory<T>,
  validConfig: VaultConfig,
  invalidConfig: VaultConfig,
  validContext: ExecutionContext,
  validAction: TransactionAction
): void {
  describe(`VaultAdapter Conformance: ${name}`, () => {
    it('exposes non-empty identity metadata', () => {
      const adapter = factory()
      expect(adapter.name).toBeTypeOf('string')
      expect(adapter.name.length).toBeGreaterThan(0)
      expect(adapter.version).toMatch(/^\d+\.\d+\.\d+$/)
    })

    it('rejects invalid config', async () => {
      const adapter = factory()
      await expect(adapter.connect(invalidConfig)).rejects.toThrow()
    })

    it('connect/disconnect is safe and health reflects state', async () => {
      const adapter = factory()
      await adapter.connect(validConfig)
      expect((await adapter.health()).connected).toBe(true)
      await adapter.disconnect()
      expect((await adapter.health()).connected).toBe(false)
    })

    it('does not expose secret material through listCredentials metadata', async () => {
      const adapter = factory()
      await adapter.connect(validConfig)
      const credentials = await adapter.listCredentials(validContext.principalId)
      credentials.forEach(c => {
        const s = JSON.stringify(c)
        expect(s).not.toMatch(/secret|token|password|private[_-]?key/i)
      })
      await adapter.disconnect()
    })

    it('execution failure path is explicit and non-leaking', async () => {
      const adapter = factory()
      await adapter.connect(validConfig)
      try {
        await adapter.execute('unknown_credential', validAction, validContext)
        throw new Error('expected execute to fail for unknown credential')
      } catch (err: any) {
        const msg = String(err?.message || '')
        expect(msg).not.toMatch(/secret|token|password|private[_-]?key/i)
      }
      await adapter.disconnect()
    })
  })
}
