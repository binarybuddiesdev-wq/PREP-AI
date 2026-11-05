import { chromium, expect, test } from '@playwright/test';

test('applies the saved PrepAI light and dark theme across reloads', async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: 'chrome' });
  }
  const page = await browser.newPage();
  const browserErrors = [];

  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await expect
      .poll(() =>
        page
          .locator('.landing-hero h1 em')
          .evaluate((element) => element.ownerDocument.defaultView.getComputedStyle(element).color)
      )
      .not.toBe('rgba(0, 0, 0, 0)');
    await expect
      .poll(() =>
        page
          .locator('.landing-results strong')
          .first()
          .evaluate((element) => element.ownerDocument.defaultView.getComputedStyle(element).color)
      )
      .not.toBe('rgba(0, 0, 0, 0)');
    await expect
      .poll(() =>
        page
          .getByText('Choose a topic and target difficulty')
          .evaluate(
            (element) =>
              element.ownerDocument.defaultView.getComputedStyle(element.closest('p')).opacity
          )
      )
      .toBe('1');
    await expect
      .poll(
        () =>
          page
            .getByText('Review feedback and choose a next step')
            .evaluate(
              (element) =>
                element.ownerDocument.defaultView.getComputedStyle(element.closest('p')).opacity
            ),
        { timeout: 1_500 }
      )
      .toBe('1');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect
      .poll(() =>
        page
          .locator('html')
          .evaluate(
            (element) => element.ownerDocument.defaultView.getComputedStyle(element).fontFamily
          )
      )
      .toContain('DM Sans');
    await expect
      .poll(() =>
        page
          .locator('html')
          .evaluate(
            (element) => element.ownerDocument.defaultView.getComputedStyle(element).fontSize
          )
      )
      .toBe('16px');
    await expect
      .poll(() =>
        page
          .locator('html')
          .evaluate((element) =>
            element.ownerDocument.defaultView
              .getComputedStyle(element)
              .getPropertyValue('--accent')
              .trim()
          )
      )
      .toBe('#f59e0b');

    await page.setViewportSize({ width: 320, height: 568 });
    await expect
      .poll(() =>
        page
          .locator('html')
          .evaluate((element) => element.ownerDocument.documentElement.scrollWidth)
      )
      .toBeLessThanOrEqual(320);
    await page.setViewportSize({ width: 768, height: 900 });
    await expect
      .poll(() =>
        page
          .locator('html')
          .evaluate((element) => element.ownerDocument.documentElement.scrollWidth)
      )
      .toBeLessThanOrEqual(768);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect
      .poll(() =>
        page
          .locator('html')
          .evaluate((element) =>
            element.ownerDocument.defaultView
              .getComputedStyle(element)
              .getPropertyValue('--bg')
              .trim()
          )
      )
      .toBe('#f8f9fa');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
  }
});
