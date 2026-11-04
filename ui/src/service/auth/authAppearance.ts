export const authAppearance = {
  variables: {
    colorPrimary: '#f59e0b',
    colorText: '#fafafa',
    colorTextSecondary: '#a1a1aa',
    colorBackground: '#18181b',
    colorInputBackground: '#09090b',
    colorInputText: '#fafafa',
    borderRadius: '0.5rem',
    fontFamily: 'DM Sans, sans-serif',
  },
  elements: {
    rootBox: '!w-full !min-w-0',
    cardBox: '!w-full !min-w-0',
    card: '!w-full !max-w-none !border-0 !bg-transparent !p-0 !shadow-none',
    headerTitle: 'text-xl font-semibold tracking-tight text-zinc-50',
    headerSubtitle: 'mt-1 text-sm text-zinc-400',
    socialButtonsBlockButton:
      'border border-white/10 bg-white/[0.04] text-zinc-100 transition-colors hover:bg-white/[0.08]',
    socialButtonsBlockButtonText: 'font-medium text-zinc-100',
    dividerLine: 'bg-white/10',
    dividerText: 'text-xs font-medium text-zinc-500',
    formFieldLabel: 'text-sm font-medium text-zinc-300',
    formFieldInput:
      'border-white/10 bg-[#09090b] text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:ring-amber-500/20',
    formButtonPrimary:
      'bg-amber-500 font-semibold text-zinc-950 shadow-none transition hover:bg-amber-400 hover:shadow-[0_6px_24px_rgba(245,158,11,0.24)]',
    footerAction: 'mt-5 text-sm text-zinc-400',
    footerActionLink: 'font-medium text-amber-400 hover:text-amber-300',
    identityPreview: 'border-white/10 bg-white/[0.04]',
    identityPreviewText: 'text-zinc-100',
    identityPreviewEditButton: 'text-amber-400 hover:text-amber-300',
    formFieldAction: 'text-amber-400 hover:text-amber-300',
    alert: 'border-red-400/20 bg-red-400/10 text-red-200',
    formFieldErrorText: 'text-red-300',
  },
} as const;
