import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect } from 'react';

import type { IToastMessage } from '@/core';
import { cn } from '@/utils';

interface IToastViewportProps {
  toasts: IToastMessage[];
  theme: 'light' | 'dark';
  onDismiss: (id: string) => void;
}

const TOAST_TIMEOUT_MS = 6000;

const toastAppearance = {
  success: {
    Icon: CheckCircle2,
    iconClassName: 'text-emerald-500',
    role: 'status' as const,
  },
  error: {
    Icon: XCircle,
    iconClassName: 'text-rose-500',
    role: 'alert' as const,
  },
  warning: { Icon: AlertTriangle, iconClassName: 'text-amber-500', role: 'status' as const },
  info: { Icon: Info, iconClassName: 'text-sky-500', role: 'status' as const },
};

export const ToastViewport = ({ toasts, theme, onDismiss }: IToastViewportProps) => {
  const isLight = theme === 'light';

  return (
    <div
      aria-label="Status updates"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-end gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:w-[min(24rem,calc(100vw-3rem))] sm:px-0"
      role="region"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          isLight={isLight}
          message={toast.message}
          kind={toast.kind}
          onDismiss={onDismiss}
          toastId={toast.id}
        />
      ))}
    </div>
  );
};

interface IToastItemProps {
  id: string;
  isLight: boolean;
  kind: keyof typeof toastAppearance;
  message: string;
  onDismiss: (id: string) => void;
  toastId: string;
}

const ToastItem = ({ id, isLight, kind, message, onDismiss, toastId }: IToastItemProps) => {
  const { Icon, iconClassName, role } = toastAppearance[kind];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => onDismiss(toastId), TOAST_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [id, onDismiss, toastId]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-3 py-3 shadow-[0_12px_35px_rgba(0,0,0,0.22)] animate-in fade-in slide-in-from-bottom-2 duration-200',
        isLight
          ? 'border-zinc-200 bg-white text-zinc-900'
          : 'border-white/10 bg-[#18181b] text-zinc-100'
      )}
      role={role}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', iconClassName)} />
      <p className="min-w-0 flex-1 text-sm leading-5">{message}</p>
      <button
        type="button"
        aria-label="Dismiss notification"
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-amber-400',
          isLight ? 'text-zinc-500 hover:bg-zinc-100' : 'text-zinc-400 hover:bg-white/[0.08]'
        )}
        onClick={() => onDismiss(toastId)}
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
};
