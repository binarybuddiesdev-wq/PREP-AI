import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ROUTES } from '@/core';
import type { IAppShellProps } from './AppShell.types';
import { AppShell } from './AppShell';

const createShellProps = (overrides: Partial<IAppShellProps> = {}): IAppShellProps =>
  ({
    activeRoute: ROUTES.dashboard,
    brand: <span>PrepAI</span>,
    pageTitle: 'Dashboard',
    navigation: [
      {
        label: 'Main',
        items: [
          { label: 'Dashboard', route: ROUTES.dashboard, icon: <span>D</span> },
          { label: 'Practice', route: null, icon: <span>P</span> },
        ],
      },
      {
        label: 'Track',
        items: [{ label: 'Settings', route: ROUTES.settings, icon: <span>S</span> }],
      },
    ],
    userName: 'Asha',
    userEmail: 'asha@example.com',
    userMenu: <button aria-label="Clerk user menu">Account</button>,
    theme: 'dark' as const,
    themeIcon: <span aria-hidden="true">Theme icon</span>,
    mobileMenuIcon: <span aria-hidden="true">Menu icon</span>,
    collapseIcon: <span aria-hidden="true">Collapse icon</span>,
    expandIcon: <span aria-hidden="true">Expand icon</span>,
    onNavigate: vi.fn(),
    onThemeToggle: vi.fn(),
    children: <h1>Dashboard content</h1>,
    ...overrides,
  }) as IAppShellProps;

describe('AppShell', () => {
  it('shows the current section and disables routes that are not implemented', () => {
    render(<AppShell {...createShellProps()} />);

    expect(within(screen.getByRole('banner')).getByText('Dashboard')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const practiceItem = screen.getByRole('button', { name: 'Practice, coming soon' });
    expect(practiceItem).toBeDisabled();
    expect(practiceItem).toHaveAttribute('title', 'Practice is coming soon');
    expect(within(practiceItem).getByText('Soon')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Clerk user menu' })).toBeVisible();
    expect(screen.getByText('Asha')).toBeVisible();
  });

  it('renders optional header actions beside theme and account controls', () => {
    render(
      <AppShell
        {...createShellProps({
          headerActions: <button type="button">Notifications</button>,
        })}
      />
    );

    const banner = within(screen.getByRole('banner'));
    expect(banner.getByRole('button', { name: 'Notifications' })).toBeVisible();
    expect(banner.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
    expect(banner.getByRole('button', { name: 'Clerk user menu' })).toBeVisible();
  });

  it('renders leading header actions before the theme control', () => {
    render(
      <AppShell
        {...createShellProps({
          headerLeadingActions: <button type="button">Search</button>,
        })}
      />
    );

    const banner = within(screen.getByRole('banner'));
    const search = banner.getByRole('button', { name: 'Search' });
    const theme = banner.getByRole('button', { name: 'Switch to light theme' });
    expect(search).toBeVisible();
    expect(search.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('routes from the sidebar and closes the mobile drawer after selection', async () => {
    const user = userEvent.setup();
    const props = createShellProps();
    render(<AppShell {...props} />);

    const openNavigationButton = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(openNavigationButton).toHaveAttribute('aria-expanded', 'false');
    expect(openNavigationButton).toHaveAttribute('aria-controls', 'primary-navigation');
    await user.click(openNavigationButton);
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(props.onNavigate).toHaveBeenCalledWith(ROUTES.settings);
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveFocus();
  });

  it('closes the mobile drawer when the brand link is used', async () => {
    const user = userEvent.setup();
    render(<AppShell {...createShellProps({ brand: <button type="button">PrepAI</button> })} />);

    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    await user.click(screen.getByRole('button', { name: 'PrepAI' }));

    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('closes with Escape and restores focus to the menu trigger', async () => {
    const user = userEvent.setup();
    render(<AppShell {...createShellProps()} />);

    const menuTrigger = screen.getByRole('button', { name: 'Open navigation menu' });
    await user.click(menuTrigger);
    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(menuTrigger).toHaveFocus();
  });

  it('keeps Tab navigation inside the open mobile drawer', async () => {
    const user = userEvent.setup();
    render(<AppShell {...createShellProps()} />);

    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const dashboardItem = screen.getByRole('button', { name: 'Dashboard' });
    const settingsItem = screen.getByRole('button', { name: 'Settings' });
    settingsItem.focus();
    await user.keyboard('{Tab}');

    expect(dashboardItem).toHaveFocus();
  });

  it('collapses the desktop sidebar and toggles the selected theme', async () => {
    const user = userEvent.setup();
    const props = createShellProps();
    render(<AppShell {...props} />);

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));

    expect(props.onThemeToggle).toHaveBeenCalledOnce();
  });

  it('marks the compact rail state on the shell for responsive brand styling', async () => {
    const user = userEvent.setup();
    const { container } = render(<AppShell {...createShellProps()} />);
    const shell = container.querySelector('.app-shell');

    expect(shell).toHaveAttribute('data-collapsed', 'false');
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(shell).toHaveAttribute('data-collapsed', 'true');
  });
});
