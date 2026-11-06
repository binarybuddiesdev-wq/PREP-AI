import { chromium, expect, test } from '@playwright/test';

const openBrowser = async () => {
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ channel: 'chrome' });
  }
};

test('Study Chat fits phone, tablet, and desktop layouts in both themes', async () => {
  const browser = await openBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const loadViteDependency = (name) => {
        const resource = globalThis.performance
          .getEntriesByType('resource')
          .find((entry) =>
            new globalThis.URL(entry.name).pathname.endsWith(`/node_modules/.vite/deps/${name}.js`)
          );
        if (!resource) throw new Error(`Vite dependency was not loaded: ${name}`);
        return import(resource.name);
      };
      const react = await loadViteDependency('react');
      const reactDom = await loadViteDependency('react-dom_client');
      const createElement = react.createElement ?? react.default?.createElement;
      const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
      const { StudyChatPanel } = await import('/src/components/studyChat/StudyChatPanel.tsx');
      const preview = globalThis.document.createElement('div');
      preview.id = 'study-chat-preview';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);
      const props = {
        isOpen: true,
        isFullscreen: false,
        view: 'transcript',
        theme: 'dark',
        children: createElement('div', { className: 'min-h-0 flex-1 p-4' }, 'Chat transcript'),
        onClose: () => {},
        onToggleFullscreen: () => {},
        onToggleView: () => {},
        onNewConversation: () => {},
      };
      const root = createRoot(preview);
      globalThis.__studyChatPreview = { root, createElement, StudyChatPanel, props };
      root.render(createElement(StudyChatPanel, props));
    });

    const panel = page.getByRole('dialog', { name: 'PrepAI Assistant' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS('background-color', 'rgb(17, 17, 19)');
    await page.evaluate(() => {
      const preview = globalThis.__studyChatPreview;
      preview.props = { ...preview.props, theme: 'light' };
      preview.root.render(preview.createElement(preview.StudyChatPanel, preview.props));
    });
    await expect(panel).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    for (const isFullscreen of [false, true]) {
      await page.evaluate((fullscreen) => {
        const preview = globalThis.__studyChatPreview;
        preview.props = { ...preview.props, isFullscreen: fullscreen };
        preview.root.render(preview.createElement(preview.StudyChatPanel, preview.props));
      }, isFullscreen);
      for (const viewport of [
        { width: 320, height: 740 },
        { width: 390, height: 844 },
        { width: 768, height: 900 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(viewport);
        await expect
          .poll(() =>
            panel.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return rect.left >= 0 && rect.right <= globalThis.innerWidth;
            })
          )
          .toBe(true);
      }
    }
  } finally {
    await browser.close();
  }
});

test('notification popover stays within the viewport and follows the theme', async () => {
  const browser = await openBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const loadViteDependency = (name) => {
        const resource = globalThis.performance
          .getEntriesByType('resource')
          .find((entry) =>
            new globalThis.URL(entry.name).pathname.endsWith(`/node_modules/.vite/deps/${name}.js`)
          );
        if (!resource) throw new Error(`Vite dependency was not loaded: ${name}`);
        return import(resource.name);
      };
      const react = await loadViteDependency('react');
      const reactDom = await loadViteDependency('react-dom_client');
      const router = await loadViteDependency('react-router');
      const createElement = react.createElement ?? react.default?.createElement;
      const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
      const MemoryRouter = router.MemoryRouter ?? router.default?.MemoryRouter;
      const { NotificationPopover } =
        await import('/src/components/notifications/NotificationPopover.tsx');
      const preview = globalThis.document.createElement('div');
      preview.id = 'notification-preview';
      preview.style.position = 'fixed';
      preview.style.top = '16px';
      preview.style.right = '16px';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);
      const props = {
        isOpen: true,
        notifications: [
          {
            id: 'notice-one',
            category: 'reminder',
            title: 'Practice today',
            body: 'Take a few minutes to practice today.',
            link: '/dashboard',
            readAt: null,
            createdAt: '2026-11-05T06:00:00.000Z',
          },
        ],
        unreadCount: 1,
        unreadCountError: null,
        errorMessage: null,
        actionErrorMessage: null,
        hasLoaded: true,
        isLoading: false,
        isLoadingMore: false,
        hasMore: false,
        pendingNotificationId: null,
        isMarkingAllRead: false,
        theme: 'dark',
        onOpenChange: () => {},
        onRetry: () => {},
        onRetryUnreadCount: () => {},
        onMarkRead: () => {},
        onMarkAllRead: () => {},
        onDelete: () => {},
        onLoadMore: () => {},
        onOpenNotification: () => {},
      };
      const root = createRoot(preview);
      globalThis.__notificationPreview = {
        root,
        createElement,
        MemoryRouter,
        NotificationPopover,
        props,
      };
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ['/dashboard'] },
          createElement(NotificationPopover, props)
        )
      );
    });

    const popover = page.getByRole('dialog', { name: 'Notifications' });
    await expect(popover).toBeVisible();
    await expect(popover).toHaveCSS('background-color', 'rgb(21, 21, 24)');
    await expect(popover.getByRole('link', { name: /Practice today/ })).toBeVisible();

    await page.evaluate(() => {
      const preview = globalThis.__notificationPreview;
      preview.props = { ...preview.props, theme: 'light' };
      preview.root.render(
        preview.createElement(
          preview.MemoryRouter,
          { initialEntries: ['/dashboard'] },
          preview.createElement(preview.NotificationPopover, preview.props)
        )
      );
    });
    await expect(popover).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          popover.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left >= 0 && rect.right <= globalThis.innerWidth;
          })
        )
        .toBe(true);
    }
  } finally {
    await browser.close();
  }
});
