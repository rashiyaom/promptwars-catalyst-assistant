import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.ts', 'shared/**/*.ts', 'web/src/features/taus/*.ts'],
      exclude: ['**/index.ts', '**/types/*.ts', '**/base.ts'],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 85 },
    },
  },
});
