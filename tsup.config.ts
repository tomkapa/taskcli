import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node25',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  onSuccess:
    'mkdir -p dist/migrations && cp src/db/migrations/*.sql dist/migrations/ && find dist -name "*.js" | xargs sed -i "" \'s|from "sqlite"|from "node:sqlite"|g\'',
});
