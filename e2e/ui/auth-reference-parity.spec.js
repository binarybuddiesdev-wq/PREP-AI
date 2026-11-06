import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const readCard = async (page, selector) =>
  page.locator(selector).evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });

test('matches the reference authentication card at desktop and mobile sizes', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    for (const auth of [
      { route: '/sign-in', isSignUp: false },
      { route: '/sign-up', isSignUp: true },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(pathToFileURL(resolve('prepai-ui.html')).href, { waitUntil: 'networkidle' });
      await page.locator('#scr-auth').evaluate((element) => (element.hidden = false));
      if (auth.isSignUp) await page.evaluate(() => globalThis.flipAuth());
      const reference = await readCard(page, '.au-card');

      await page.goto(auth.route, { waitUntil: 'networkidle' });
      await expect(page.locator('.cl-card')).toBeVisible();
      const implementation = await readCard(page, '.auth-page-card');

      expect(Math.abs(implementation.x - reference.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(implementation.y - reference.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(implementation.width - reference.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(implementation.height - reference.height)).toBeLessThanOrEqual(2);
      await expect(page.locator('.cl-socialButtonsBlockButton')).toHaveCount(3);
      await expect(page.locator('.cl-socialButtonsBlockButton').first()).toHaveCSS(
        'color',
        'rgb(250, 250, 250)'
      );
      await expect(page.locator('.cl-socialButtonsBlockButton').first()).not.toHaveCSS(
        'border-top-color',
        'rgb(245, 158, 11)'
      );
      for (const provider of ['Google', 'GitHub', 'LinkedIn']) {
        await expect(page.getByRole('button', { name: new RegExp(provider) })).toBeVisible();
      }
    }
  }
});
