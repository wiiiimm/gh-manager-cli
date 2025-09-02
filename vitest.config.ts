import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs']
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
    pool: 'forks',
    // Run tests in a single thread to avoid worker pool issues in constrained environments
    singleThread: true,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'dist/**',
        'tests/**',
        'test-*.{ts,tsx,js}',
        '*.config.{ts,js}',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'node_modules/**',
        '.github/**'
      ],
      all: true,
      clean: true,
      skipFull: false,
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0
      }
    }
  },
});
