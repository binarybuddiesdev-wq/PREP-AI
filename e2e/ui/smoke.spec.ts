import { test, expect } from '@playwright/test';

test.describe('Frontend Smoke Tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PrepAI/);
  });

  test('landing page renders hero section', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'The smarter way to prepare for interviews' })
    ).toBeVisible();
  });
});
