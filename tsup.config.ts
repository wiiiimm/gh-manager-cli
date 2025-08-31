import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  outDir: 'dist',
  clean: true,
  format: ['esm'],
  target: 'node18',
  sourcemap: false,
  dts: false,
  shims: false,
  banner: { js: '#!/usr/bin/env node' },
});
