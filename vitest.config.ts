import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts', 'sdk/**/*.test.ts'],
    exclude: ['node_modules', 'archive-*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts', 'sdk/typescript/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        'src/index.ts',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    },
    testTimeout: process.env.CI ? 30000 : 10000,
    retry: process.env.CI ? 2 : 0,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@domain': resolve(__dirname, './src/domain'),
      '@tests': resolve(__dirname, './tests'),
    }
  }
})
