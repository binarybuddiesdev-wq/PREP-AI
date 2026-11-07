import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('global search, notifications, and Study Chat match reference bounds and interactions', async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: 'chrome' });
  }
  const reactPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const reference = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await reactPage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await reference.goto(pathToFileURL(resolve('prepai-ui.html')).href);
    await reference.evaluate(() => globalThis.go('app'));
    await reactPage.evaluate(async () => {
      const loadDependency = async (name) => {
        const resource = globalThis.performance
          .getEntriesByType('resource')
          .find((entry) =>
            new globalThis.URL(entry.name).pathname.endsWith(`/node_modules/.vite/deps/${name}.js`)
          );
        if (!resource) throw new Error(`Vite dependency was not loaded: ${name}`);
        return import(resource.name);
      };
      const react = await loadDependency('react');
      const createElement = react.createElement ?? react.default?.createElement;
      const useState = react.useState ?? react.default?.useState;
      const reactDom = await loadDependency('react-dom_client');
      const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
      const router = await loadDependency('react-router');
      const MemoryRouter = router.MemoryRouter ?? router.default?.MemoryRouter;
      const { GlobalSearch } = await import('/src/components/search/GlobalSearch.tsx');
      const { NotificationPopover } =
        await import('/src/components/notifications/NotificationPopover.tsx');
      const { StudyChatPanel } = await import('/src/components/studyChat/StudyChatPanel.tsx');
      const { StudyChatLauncher } = await import('/src/components/studyChat/StudyChatLauncher.tsx');
      const { StudyChatTranscript } =
        await import('/src/components/studyChat/StudyChatTranscript.tsx');
      const { StudyChatComposer } = await import('/src/components/studyChat/StudyChatComposer.tsx');
      const mount = globalThis.document.createElement('div');
      mount.id = 'global-overlays-preview';
      mount.style.cssText = 'position:absolute;inset:0;pointer-events:none';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(mount);
      const topics = [
        {
          type: 'topic',
          id: 'react-hooks',
          topicId: 'react-hooks',
          label: 'React Hooks',
          category: 'Practice',
          route: '/practice',
          keywords: [],
        },
      ];
      const notifications = [
        {
          id: 'notification-1',
          category: 'session',
          title: 'Session Complete',
          body: 'You scored 8.5/10 on React Hooks',
          link: '/dashboard',
          readAt: null,
          createdAt: '2026-11-06T10:00:00.000Z',
        },
        {
          id: 'notification-2',
          category: 'topic',
          title: 'New Topic Available',
          body: 'GraphQL questions just added',
          link: '/practice',
          readAt: null,
          createdAt: '2026-11-06T09:00:00.000Z',
        },
        {
          id: 'notification-3',
          category: 'streak',
          title: 'Streak Milestone',
          body: 'You hit a 7-day practice streak!',
          link: '/dashboard',
          readAt: null,
          createdAt: '2026-11-06T08:00:00.000Z',
        },
        {
          id: 'notification-4',
          category: 'report',
          title: 'Weekly Report',
          body: 'Your performance summary is ready',
          link: '/history',
          readAt: '2026-11-05T08:00:00.000Z',
          createdAt: '2026-11-05T08:00:00.000Z',
        },
      ];
      const Harness = () => {
        const [searchOpen, setSearchOpen] = useState(false);
        const [query, setQuery] = useState('');
        const [noticeOpen, setNoticeOpen] = useState(false);
        const [chatOpen, setChatOpen] = useState(false);
        const [fullscreen, setFullscreen] = useState(false);
        const [draft, setDraft] = useState('');
        const [sent, setSent] = useState('');
        return createElement(
          MemoryRouter,
          null,
          createElement(
            'div',
            { style: { pointerEvents: 'auto' } },
            createElement(
              'div',
              { style: { position: 'fixed', top: '14px', right: '176px' } },
              createElement(GlobalSearch, {
                isOpen: searchOpen,
                query,
                results: query.trim() ? topics : [],
                isLoading: false,
                errorMessage: null,
                theme: 'dark',
                onOpenChange: setSearchOpen,
                onQueryChange: setQuery,
                onRetry: () => {},
                onSelect: (result) => {
                  globalThis.window.__pickedSearch = result.id;
                },
              })
            ),
            createElement(
              'div',
              { style: { position: 'fixed', top: '14px', right: '56px' } },
              createElement(NotificationPopover, {
                isOpen: noticeOpen,
                onOpenChange: setNoticeOpen,
                notifications,
                unreadCount: 3,
                unreadCountError: null,
                errorMessage: null,
                hasLoaded: true,
                actionErrorMessage: null,
                isLoading: false,
                isLoadingMore: false,
                hasMore: false,
                pendingNotificationId: null,
                isMarkingAllRead: false,
                theme: 'dark',
                onRetry: () => {},
                onRetryUnreadCount: () => {},
                onMarkRead: () => {},
                onMarkAllRead: () => {
                  globalThis.window.__markedAllRead = true;
                },
                onDelete: () => {},
                onLoadMore: () => {},
                onOpenNotification: () => {},
              })
            ),
            createElement(
              'div',
              null,
              chatOpen &&
                createElement(StudyChatPanel, {
                  isOpen: true,
                  isFullscreen: fullscreen,
                  view: 'transcript',
                  theme: 'dark',
                  onClose: () => setChatOpen(false),
                  onToggleFullscreen: () => setFullscreen(!fullscreen),
                  onToggleView: () => {},
                  onNewConversation: () => {},
                  children: createElement(
                    'div',
                    { className: 'flex min-h-0 flex-1 flex-col' },
                    createElement(StudyChatTranscript, { messages: [], theme: 'dark' }),
                    createElement(StudyChatComposer, {
                      draft,
                      maxLength: 4000,
                      theme: 'dark',
                      onDraftChange: setDraft,
                      onSubmit: (message) => {
                        setSent(message);
                        setDraft('');
                        globalThis.window.__sentChat = message;
                      },
                    })
                  ),
                }),
              createElement(StudyChatLauncher, {
                isOpen: chatOpen,
                onToggle: () => setChatOpen(!chatOpen),
              })
            ),
            sent && createElement('span', { 'data-testid': 'sent-chat' }, sent)
          )
        );
      };
      createRoot(mount).render(createElement(Harness));
    });

    await reference.locator('#search-icon').click();
    await reference.locator('#tb-search-input').fill('react');
    await reactPage.getByRole('button', { name: 'Search pages and topics' }).click();
    const reactSearch = reactPage.getByRole('combobox', { name: 'Search pages and topics' });
    await reactSearch.fill('react');
    const refSearchBounds = await reference.locator('#tb-search').boundingBox();
    const uiSearchBounds = await reactSearch.locator('..').boundingBox();
    expect(Math.abs(refSearchBounds.width - uiSearchBounds.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(refSearchBounds.height - uiSearchBounds.height)).toBeLessThanOrEqual(2);
    const refResults = await reference.locator('#search-results').boundingBox();
    const uiResults = await reactPage
      .getByRole('listbox', { name: 'Search results' })
      .locator('..')
      .boundingBox();
    expect(Math.abs(refResults.width - uiResults.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(refResults.x - uiResults.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(refResults.y - uiResults.y)).toBeLessThanOrEqual(2);
    await reactSearch.press('ArrowDown');
    await reactSearch.press('Enter');
    await expect
      .poll(() => reactPage.evaluate(() => globalThis.window.__pickedSearch))
      .toBe('react-hooks');

    await reference.locator('.tb-icon[title="Notifications"]').click();
    await reactPage.getByRole('button', { name: 'Notifications, 3 unread' }).click();
    const refNotifications = await reference.locator('#tb-notif').boundingBox();
    const uiNotifications = await reactPage
      .getByRole('dialog', { name: 'Notifications' })
      .boundingBox();
    expect(Math.abs(refNotifications.width - uiNotifications.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(refNotifications.height - uiNotifications.height)).toBeLessThanOrEqual(4);
    await reactPage.getByRole('button', { name: 'Mark all as read' }).click();
    await expect.poll(() => reactPage.evaluate(() => globalThis.window.__markedAllRead)).toBe(true);

    await reference.locator('#chat-bubble').click();
    await reactPage.getByRole('button', { name: 'Open PrepAI Assistant' }).click();
    const refChat = await reference.locator('#chat-popup').boundingBox();
    const uiChat = await reactPage.getByRole('dialog', { name: 'PrepAI Assistant' }).boundingBox();
    expect(Math.abs(refChat.width - uiChat.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(refChat.height - uiChat.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(refChat.x - uiChat.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(refChat.y - uiChat.y)).toBeLessThanOrEqual(2);
    const refChatHeader = await reference.locator('.chat-header').boundingBox();
    const uiChatHeader = await reactPage
      .getByRole('dialog', { name: 'PrepAI Assistant' })
      .locator('header')
      .boundingBox();
    expect(Math.abs(refChatHeader.height - uiChatHeader.height)).toBeLessThanOrEqual(2);
    const refComposer = await reference.locator('.chat-input-wrap').boundingBox();
    const uiComposer = await reactPage.getByRole('form', { name: 'Send a message' }).boundingBox();
    expect(
      Math.abs(refComposer.height - uiComposer.height),
      JSON.stringify({ refComposer, uiComposer })
    ).toBeLessThanOrEqual(2);
    const chatInput = reactPage.getByRole('textbox', { name: 'Message PrepAI Assistant' });
    await chatInput.fill('Explain closures.');
    await reactPage.getByRole('button', { name: 'Send message' }).click();
    await expect
      .poll(() => reactPage.evaluate(() => globalThis.window.__sentChat))
      .toBe('Explain closures.');

    await reactPage.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        reactPage.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth >
            globalThis.document.documentElement.clientWidth
        )
      )
      .toBe(false);
  } finally {
    await browser.close();
  }
});
