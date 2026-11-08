import { expect, test } from '@playwright/test';

const protectedRoutes = [
  '/dashboard',
  '/practice',
  '/coding',
  '/coding/two-sum',
  '/history',
  '/history/example-session',
  '/settings',
  '/settings/documents',
  '/library',
  '/onboarding',
];

const seededShuffle = (items, seed = 0x5eed) => {
  const values = [...items];
  let state = seed >>> 0;
  for (let index = values.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
};

test('randomized full route walk preserves public screens and guards every private screen', async ({
  page,
}) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  for (const viewport of [
    { width: 320, height: 740 },
    { width: 768, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page).toHaveTitle(/PrepAI/);
    await expect(
      page.getByRole('heading', { name: 'The smarter way to prepare for interviews' })
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => globalThis.document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width);

    await page.goto('/sign-up');
    await expect(page).toHaveURL(/\/sign-up/);
    await expect(page.getByRole('main', { name: 'Account access' })).toBeVisible();
    await expect(page.locator('.cl-formButtonPrimary')).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() => page.evaluate(() => globalThis.document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width);

    await page.goto('/sign-in');
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.locator('.cl-formButtonPrimary')).toBeVisible({ timeout: 15_000 });
  }

  for (const route of seededShuffle(protectedRoutes)) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.locator('.cl-formButtonPrimary')).toBeVisible({ timeout: 15_000 });
  }

  await page.goto('/this-route-does-not-exist');
  await expect(page).toHaveURL(/\/sign-in/);
  expect(runtimeErrors).toEqual([]);
});

test('landing page links survive randomized clicks and browser back navigation', async ({
  page,
}) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  const signInLink = page.getByRole('link', { name: 'Log in' });
  await signInLink.click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('heading', { name: 'The smarter way to prepare for interviews' })
  ).toBeVisible();

  const signUpLink = page.getByRole('link', { name: 'Start Practicing' });
  await signUpLink.click();
  await expect(page).toHaveURL(/\/sign-up/);
  await expect(page.locator('.cl-formButtonPrimary')).toBeVisible({ timeout: 15_000 });
  expect(runtimeErrors).toEqual([]);
});
