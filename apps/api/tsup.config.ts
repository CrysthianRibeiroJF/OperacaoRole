import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Pacotes do workspace são TypeScript puro: entram no bundle.
  noExternal: [/^@role\//],
  external: ['better-sqlite3'],
});
