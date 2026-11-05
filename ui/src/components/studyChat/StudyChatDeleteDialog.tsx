import { Dialog } from '@base-ui/react/dialog';
import { LoaderCircle, Trash2, X } from 'lucide-react';

import type { IStudyChatDeleteDialogProps } from './StudyChatDeleteDialog.types';

export const StudyChatDeleteDialog = (props: IStudyChatDeleteDialogProps) => {
  const { conversation, isPending, errorMessage, theme = 'dark', onClose, onConfirm } = props;
  const isDarkTheme = theme === 'dark';

  return (
    <Dialog.Root open={Boolean(conversation)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-[2px] data-[open]:animate-in data-[open]:fade-in" />
        <Dialog.Viewport className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto p-4">
          <Dialog.Popup
            className={`w-full max-w-sm rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.4)] ${isDarkTheme ? 'border-white/[0.1] bg-[#18181b] text-zinc-100' : 'border-zinc-200 bg-white text-zinc-900'}`}
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title
                  className={`text-base font-semibold ${isDarkTheme ? 'text-zinc-100' : 'text-zinc-900'}`}
                >
                  Delete conversation?
                </Dialog.Title>
                <Dialog.Description
                  className={`mt-2 text-sm leading-5 ${isDarkTheme ? 'text-zinc-400' : 'text-zinc-600'}`}
                >
                  {conversation
                    ? `“${conversation.title}” and its messages will be permanently deleted.`
                    : 'This conversation will be permanently deleted.'}
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Close delete confirmation"
                disabled={isPending}
                className={`grid size-8 shrink-0 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 ${isDarkTheme ? 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-100' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
              >
                <X aria-hidden="true" className="size-4" />
              </Dialog.Close>
            </header>
            {errorMessage && (
              <p
                role="alert"
                className={`mt-4 rounded-lg border p-3 text-sm leading-5 ${isDarkTheme ? 'border-rose-400/20 bg-rose-400/[0.07] text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-800'}`}
              >
                {errorMessage}
              </p>
            )}
            <footer className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                className={`min-h-10 rounded-lg border px-3.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 ${isDarkTheme ? 'border-white/[0.12] text-zinc-300 hover:bg-white/[0.06]' : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100'}`}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                aria-label={
                  isPending
                    ? 'Deleting conversation'
                    : errorMessage
                      ? 'Retry delete'
                      : 'Delete conversation'
                }
                disabled={isPending}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-rose-300 px-3.5 text-sm font-semibold text-zinc-950 hover:bg-rose-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:cursor-wait disabled:opacity-60"
                onClick={onConfirm}
              >
                {isPending ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Trash2 aria-hidden="true" className="size-4" />
                )}
                {isPending ? 'Deleting' : errorMessage ? 'Retry delete' : 'Delete conversation'}
              </button>
            </footer>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
