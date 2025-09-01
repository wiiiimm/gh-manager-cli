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
      reporter: ['text', 'html'],
      exclude: ['dist/**', 'tests/**']
    }
  },
});
