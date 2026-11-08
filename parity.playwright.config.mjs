import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/ui',
  testMatch: '**/*.spec.js',
  testIgnore: '**/smoke.spec.js',
  projects: [{ name: 'ui-chromium', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' } }],
});
