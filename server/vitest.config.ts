import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { fileURLToPath } from 'url';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    alias: {
      '@/modules/question/question-seed.js': fileURLToPath(
        new URL('./src/modules/question/question-seed.ts', import.meta.url)
      ),
      '@/modules/question/question-fingerprint.js': fileURLToPath(
        new URL('./src/modules/question/question-fingerprint.ts', import.meta.url)
      ),
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
        'src/**/*.d.ts',
        'src/generated/**/*',
        'src/types/**/*',
        'src/common/index.ts',
        'src/prisma/index.ts',
        'src/config/**/*',
        'src/telemetry/instrumentation.ts',
        'src/telemetry/sdk-state.ts',
        'src/mastra/evals/run-theory-evaluation.ts',
      ],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
  plugins: [swc.vite({ module: { type: 'nodenext' } })],
});
