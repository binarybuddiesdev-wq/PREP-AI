import { Popover } from '@base-ui/react/popover';
import { Bell, LoaderCircle } from 'lucide-react';

import { cn } from '@/utils';
import type { INotificationPopoverProps } from './NotificationPopover.types';
import { NotificationRow } from './NotificationRow';

const displayUnreadCount = (count: number | null): string | null => {
  if (count === null || count <= 0) return null;
  return count > 99 ? '99+' : String(count);
};

export const NotificationPopover = (props: INotificationPopoverProps) => {
  const {
    isOpen,
    notifications,
    unreadCount,
    unreadCountError,
    errorMessage,
    hasLoaded,
    actionErrorMessage,
    isLoading,
    isLoadingMore,
    hasMore,
    pendingNotificationId,
    isMarkingAllRead,
    theme,
    onOpenChange,
    onRetry,
    onRetryUnreadCount,
    onMarkRead,
    onMarkAllRead,
    onDelete,
    onLoadMore,
    onOpenNotification,
  } = props;
  const isDark = theme === 'dark';
  const badge = displayUnreadCount(unreadCount);
  const hasUnread =
    unreadCount === null ? notifications.some((item) => !item.readAt) : unreadCount > 0;
  const buttonClass = cn(
    'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50',
    isDark
      ? 'bg-amber-300 text-zinc-950 hover:bg-amber-200'
      : 'bg-amber-400 text-zinc-950 hover:bg-amber-300'
  );

  return (
    <Popover.Root open={isOpen} onOpenChange={(open) => onOpenChange(open)}>
      <Popover.Trigger
        type="button"
        aria-label={badge ? `Notifications, ${badge} unread` : 'Notifications'}
        className={cn(
          'relative grid size-9 shrink-0 place-items-center rounded-lg border transition focus-visible:outline-2 focus-visible:outline-amber-400',
          isDark
            ? 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100'
            : 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
        )}
      >
        <Bell aria-hidden="true" className="size-[17px]" />
        {badge && (
          <span className="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-amber-400 px-1 text-center text-[9px] font-bold leading-[17px] text-zinc-950">
            {badge}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={9} className="z-50 outline-none">
          <Popover.Popup
            aria-label="Notifications"
            className={cn(
              'flex max-h-[min(72dvh,32rem)] w-[min(24rem,calc(100vw-1.5rem))] origin-top-right flex-col overflow-hidden rounded-2xl border shadow-[0_20px_65px_rgba(0,0,0,0.42)] outline-none data-[open]:animate-in data-[open]:fade-in data-[open]:zoom-in-95',
              isDark
                ? 'border-white/[0.1] bg-[#151518] text-zinc-100'
                : 'border-zinc-200 bg-white text-zinc-900'
            )}
          >
            <header
              className={cn(
                'flex shrink-0 items-center gap-3 border-b px-4 py-3',
                isDark ? 'border-white/[0.08]' : 'border-zinc-200'
              )}
            >
              <div className="min-w-0 flex-1">
                <Popover.Title
                  className={cn(
                    'text-sm font-semibold',
                    isDark ? 'text-zinc-100' : 'text-zinc-900'
                  )}
                >
                  Notifications
                </Popover.Title>
                <p className={cn('mt-0.5 text-[11px]', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  {unreadCount === null ? 'Your latest updates' : `${unreadCount} unread`}
                </p>
              </div>
              {hasUnread && (
                <button
                  type="button"
                  disabled={isMarkingAllRead}
                  onClick={onMarkAllRead}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50',
                    isDark
                      ? 'text-amber-300 hover:bg-white/[0.06]'
                      : 'text-amber-800 hover:bg-amber-50'
                  )}
                >
                  {isMarkingAllRead ? 'Marking read' : 'Mark all as read'}
                </button>
              )}
            </header>

            {unreadCountError && (
              <div
                role="status"
                className={cn(
                  'flex items-center justify-between gap-2 border-b px-4 py-2 text-[11px]',
                  isDark ? 'border-white/[0.06] text-zinc-400' : 'border-zinc-100 text-zinc-600'
                )}
              >
                <span>{unreadCountError}</span>
                <button
                  type="button"
                  onClick={onRetryUnreadCount}
                  className={cn(
                    'shrink-0 underline underline-offset-2',
                    isDark ? 'text-amber-300' : 'text-amber-800'
                  )}
                >
                  Retry unread count
                </button>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className={cn(
                  'flex items-center justify-between gap-2 border-b px-4 py-2.5 text-xs',
                  isDark ? 'border-white/[0.06] text-rose-300' : 'border-zinc-100 text-rose-700'
                )}
              >
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={onRetry}
                  className={cn(
                    'shrink-0 underline underline-offset-2',
                    isDark ? 'text-amber-300' : 'text-amber-800'
                  )}
                >
                  Retry notifications
                </button>
              </div>
            )}

            {actionErrorMessage && (
              <p
                role="alert"
                className={cn(
                  'border-b px-4 py-2.5 text-xs',
                  isDark ? 'border-white/[0.06] text-rose-300' : 'border-zinc-100 text-rose-700'
                )}
              >
                {actionErrorMessage}
              </p>
            )}

            {isLoading && notifications.length === 0 ? (
              <div
                role="status"
                className="flex min-h-28 items-center justify-center gap-2 text-xs text-zinc-500"
              >
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-amber-500" />
                Loading notifications
              </div>
            ) : notifications.length === 0 && hasLoaded ? (
              <div className="px-6 py-10 text-center">
                <Bell
                  aria-hidden="true"
                  className={cn('mx-auto size-6', isDark ? 'text-zinc-600' : 'text-zinc-400')}
                />
                <p
                  className={cn(
                    'mt-3 text-sm font-medium',
                    isDark ? 'text-zinc-200' : 'text-zinc-800'
                  )}
                >
                  You are all caught up
                </p>
                <p className={cn('mt-1 text-xs', isDark ? 'text-zinc-500' : 'text-zinc-600')}>
                  New updates will appear here.
                </p>
              </div>
            ) : (
              <ul aria-label="Notification list" className="min-h-0 flex-1 overflow-y-auto">
                {notifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    theme={theme}
                    isBusy={isMarkingAllRead || pendingNotificationId === notification.id}
                    onMarkRead={onMarkRead}
                    onDelete={onDelete}
                    onOpenNotification={(href) => onOpenNotification(notification, href)}
                  />
                ))}
              </ul>
            )}

            {hasMore && (
              <footer
                className={cn(
                  'shrink-0 border-t p-2',
                  isDark ? 'border-white/[0.08]' : 'border-zinc-200'
                )}
              >
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={onLoadMore}
                  className={cn(buttonClass, 'w-full')}
                >
                  {isLoadingMore && (
                    <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                  )}
                  {isLoadingMore ? 'Loading more notifications' : 'Load more notifications'}
                </button>
              </footer>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
