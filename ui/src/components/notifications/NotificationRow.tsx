import { Bell, BellRing, Check, Trash2 } from 'lucide-react';
import { Link } from 'react-router';

import { safeInternalPath } from '@/utils/safeInternalPath';
import { cn } from '@/utils';
import type { INotificationRowProps } from './NotificationRow.types';

const notificationDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Recently'
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const NotificationRow = ({
  notification,
  theme,
  isBusy,
  onMarkRead,
  onDelete,
  onOpenNotification,
}: INotificationRowProps) => {
  const isDark = theme === 'dark';
  const internalPath = safeInternalPath(notification.link);
  const title = (
    <span className="block truncate text-[13px] font-semibold leading-5">{notification.title}</span>
  );
  const body = <span className="mt-0.5 block text-xs leading-[1.4]">{notification.body}</span>;

  return (
    <li
      className={cn(
        'group relative flex gap-2.5 border-b px-3 py-3 last:border-b-0',
        isDark ? 'border-white/[0.06]' : 'border-zinc-100',
        notification.readAt
          ? isDark
            ? 'bg-transparent'
            : 'bg-white'
          : isDark
            ? 'bg-amber-300/[0.045]'
            : 'bg-amber-50/70'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
          isDark ? 'bg-white/[0.06] text-amber-300' : 'bg-amber-100 text-amber-800'
        )}
      >
        {notification.readAt ? <Bell className="size-4" /> : <BellRing className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        {internalPath ? (
          <Link
            to={internalPath}
            onClick={(event) => {
              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              onOpenNotification(internalPath);
            }}
            className={cn(
              'block rounded-sm focus-visible:outline-2 focus-visible:outline-amber-400',
              isDark ? 'text-zinc-100 hover:text-amber-200' : 'text-zinc-900 hover:text-amber-800'
            )}
          >
            {title}
            <span className={cn(isDark ? 'text-zinc-400' : 'text-zinc-600')}>{body}</span>
          </Link>
        ) : (
          <div className={cn(isDark ? 'text-zinc-100' : 'text-zinc-900')}>
            {title}
            <span className={cn(isDark ? 'text-zinc-400' : 'text-zinc-600')}>{body}</span>
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-2.5">
          <span
            className={cn('text-[10px] capitalize', isDark ? 'text-zinc-500' : 'text-zinc-500')}
          >
            {notification.category || 'Update'}
          </span>
          <time
            dateTime={notification.createdAt}
            title={notification.createdAt}
            className={cn('text-[10px]', isDark ? 'text-zinc-500' : 'text-zinc-500')}
          >
            {notificationDate(notification.createdAt)}
          </time>
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-0.5">
        {!notification.readAt && (
          <button
            type="button"
            aria-label={`Mark ${notification.title} as read`}
            title={`Mark ${notification.title} as read`}
            disabled={isBusy}
            onClick={() => onMarkRead(notification.id)}
            className={cn(
              'grid size-8 place-items-center rounded-lg text-[10px] transition focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50',
              isDark
                ? 'text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
            )}
          >
            <Check aria-hidden="true" className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          aria-label={`Delete ${notification.title}`}
          title={`Delete ${notification.title}`}
          disabled={isBusy}
          onClick={() => onDelete(notification.id)}
          className={cn(
            'grid size-8 place-items-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50',
            isDark
              ? 'text-zinc-500 hover:bg-rose-400/10 hover:text-rose-300'
              : 'text-zinc-500 hover:bg-rose-50 hover:text-rose-700'
          )}
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    </li>
  );
};
