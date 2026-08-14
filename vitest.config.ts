import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['packages/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
  },
  resolve: {
    alias: {
      '@quickerpay/money': resolve(__dirname, 'packages/money/src/index.ts'),
      '@quickerpay/shared-types': resolve(__dirname, 'packages/shared-types/src/index.ts'),
    },
  },
})
