import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const readLandingMeasurements = async (page, reference) =>
  page.evaluate((isReference) => {
    const heading = globalThis.document.querySelector(
      isReference ? '.ld-hero h1' : '.landing-hero h1'
    );
    const nav = globalThis.document.querySelector(isReference ? '.ld-nav' : '.landing-nav');
    const textNodes = [];
    const walker = globalThis.document.createTreeWalker(heading, globalThis.NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    const firstLineText = textNodes.find((node) => node.textContent.includes('The smarter way'));
    const secondLineText = textNodes.find((node) => node.textContent.includes('prepare for'));
    const firstLineRange = globalThis.document.createRange();
    const secondLineRange = globalThis.document.createRange();
    firstLineRange.selectNodeContents(firstLineText);
    secondLineRange.selectNodeContents(secondLineText);
    const copy = globalThis.document.querySelector(
      isReference ? '.ld-hero-left' : '.landing-hero__copy'
    );
    const navLinks = globalThis.document.querySelector(
      isReference ? '.ld-nav-links' : '.landing-nav__menu'
    );
    const navActions = globalThis.document.querySelector(
      isReference ? '.ld-nav-cta' : '.landing-nav__actions'
    );
    const terminal = globalThis.document.querySelector(
      isReference ? '.ld-terminal' : '.landing-terminal'
    );

    return {
      highlightedTop: heading.querySelector('em').getBoundingClientRect().top,
      firstLineCount: firstLineRange.getClientRects().length,
      navHeight: nav.getBoundingClientRect().height,
      navLinksLeft: navLinks?.getBoundingClientRect().left ?? 0,
      navLinksWidth: navLinks?.getBoundingClientRect().width ?? 0,
      navActionsLeft: navActions?.getBoundingClientRect().left ?? 0,
      navActionsWidth: navActions?.getBoundingClientRect().width ?? 0,
      pageWidth: globalThis.document.documentElement.scrollWidth,
      secondLineTop: secondLineRange.getBoundingClientRect().top,
      terminalHeight: terminal.getBoundingClientRect().height,
      terminalWidth: terminal.getBoundingClientRect().width,
      titleHeight: heading.getBoundingClientRect().height,
      copyHeight: copy.getBoundingClientRect().height,
    };
  }, reference);

test('matches the landing hero title wrapping and navigation height to the HTML reference', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(pathToFileURL(resolve('prepai-ui.html')).href, { waitUntil: 'networkidle' });
  const reference = await readLandingMeasurements(page, true);

  await page.goto('/', { waitUntil: 'networkidle' });
  const implementation = await readLandingMeasurements(page, false);

  expect(
    Math.abs(implementation.secondLineTop - implementation.highlightedTop)
  ).toBeLessThanOrEqual(2);
  expect(implementation.titleHeight).toBeLessThanOrEqual(reference.titleHeight + 5);
  expect(implementation.navHeight).toBeLessThanOrEqual(reference.navHeight + 2);
  expect(Math.abs(implementation.terminalWidth - reference.terminalWidth)).toBeLessThanOrEqual(2);
  expect(Math.abs(implementation.terminalHeight - reference.terminalHeight)).toBeLessThanOrEqual(6);
  expect(Math.abs(implementation.navLinksLeft - reference.navLinksLeft)).toBeLessThanOrEqual(2);
  expect(Math.abs(implementation.navLinksWidth - reference.navLinksWidth)).toBeLessThanOrEqual(2);
  expect(Math.abs(implementation.navActionsLeft - reference.navActionsLeft)).toBeLessThanOrEqual(2);
  expect(Math.abs(implementation.navActionsWidth - reference.navActionsWidth)).toBeLessThanOrEqual(
    2
  );

  await page.getByRole('link', { name: 'See how it works' }).click();
  await expect(page.locator('#ld-feats')).toBeInViewport();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pathToFileURL(resolve('prepai-ui.html')).href, { waitUntil: 'networkidle' });
  const mobileReference = await readLandingMeasurements(page, true);

  await page.goto('/', { waitUntil: 'networkidle' });
  const mobileImplementation = await readLandingMeasurements(page, false);

  expect(mobileImplementation.firstLineCount).toBe(mobileReference.firstLineCount);
  expect(mobileImplementation.titleHeight).toBeLessThanOrEqual(mobileReference.titleHeight + 5);
  expect(mobileImplementation.navHeight).toBeLessThanOrEqual(mobileReference.navHeight + 2);
  expect(mobileImplementation.copyHeight).toBeLessThanOrEqual(mobileReference.copyHeight + 30);
  expect(mobileImplementation.terminalHeight).toBeLessThanOrEqual(
    mobileReference.terminalHeight + 6
  );
  expect(mobileImplementation.pageWidth).toBeLessThanOrEqual(390);
});
