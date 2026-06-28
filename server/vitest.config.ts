import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { fileURLToPath } from 'url';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/*.types.ts',
        'src/types/**/*',
        'src/common/index.ts',
        'src/prisma/index.ts',
        'src/config/**/*',
      ],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
  plugins: [swc.vite({ module: { type: 'nodenext' } })],
});
