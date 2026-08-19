import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Component tests (.tsx) and worker tests were silently excluded by the
    // old `src/**/*.test.ts` glob — nothing warned, they simply never ran.
    // There happen to be none of either today, which is exactly why this is
    // worth fixing now: the first one written would have been quietly ignored.
    include: ['src/**/*.test.{ts,tsx}', 'worker/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ditchtheform/pricing': path.resolve(__dirname, './packages/pricing/src/index.ts'),
    },
  },
})
