import { expect, test } from '@playwright/test';
import process from 'node:process';

// Point this at a disposable test account's Playwright storageState file. Never
// export or check in the user's personal browser session.
const storageState = process.env.PREPAI_E2E_STORAGE_STATE;

test.skip(!storageState, 'Set PREPAI_E2E_STORAGE_STATE to a disposable signed-in test account.');
test.use({ storageState });

test('sidebar navigation changes both route and rendered feature screen', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  for (const [name, route, screenText] of [
    ['Practice', '/practice', 'Practice Session'],
    ['Coding', '/coding', 'Coding Questions'],
    ['History', '/history', 'Session History'],
    ['Settings', '/settings', 'Manage your profile and preferences'],
    ['Library', '/library', 'Read and manage your uploaded PDF documents'],
    ['Dashboard', '/dashboard', 'Good evening'],
  ]) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}$`));
    await expect(page.getByText(screenText, { exact: false }).first()).toBeVisible();
  }
});

test('balanced-parentheses coding detail shows consistent valid and invalid examples', async ({
  page,
}) => {
  await page.goto('/coding/parentheses-checker-snippet');

  await expect(
    page.getByRole('heading', { name: 'Validating Balanced Parentheses in Code Snippets' })
  ).toBeVisible();
  await expect(page.getByText('value = "a(b)c"', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('value = "a(b)"', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('value = "a)b("', { exact: false }).first()).toBeVisible();
});

test('practice setup remains usable and reports quota without starting a session', async ({
  page,
}) => {
  await page.goto('/practice');

  await expect(page.getByRole('heading', { name: 'Practice Session' })).toBeVisible();
  await expect(page.getByText('Topic Practice')).toBeVisible();
  await expect(page.getByText('PDF Study')).toBeVisible();

  const quotaMessage = page.getByText('Daily practice limit reached. Try again tomorrow.');
  if (await quotaMessage.isVisible()) {
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeDisabled();
  }
});

test('settings feature tabs render without API or browser errors', async ({ page }) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/api/v1/') && response.status() >= 500) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('/settings');
  for (const [tab, expected] of [
    ['Profile', 'First Name'],
    ['Notifications', 'Daily Practice Reminder'],
    ['Practice Preferences', 'Default Difficulty'],
    ['AI & Sources', 'No PDF sources yet'],
    ['Documents', 'Upload a PDF'],
    ['Plan', 'Your Plan'],
    ['Danger Zone', 'These actions cannot be performed'],
  ]) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByText(expected, { exact: false }).first()).toBeVisible();
  }
  expect(failures).toEqual([]);
});
