import {
  ONBOARDING_DIFFICULTY_OPTIONS,
  ONBOARDING_EXPERIENCE_OPTIONS,
  ONBOARDING_ROLE_OPTIONS,
} from '@/core';
import type { SettingsTab } from './SettingsFormCard.types';

export const SETTINGS_TABS: readonly { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'preferences', label: 'Practice Preferences' },
  { id: 'documents', label: 'Documents' },
];

export const SETTINGS_ROLE_OPTIONS = ONBOARDING_ROLE_OPTIONS.map(({ value }) => ({
  value,
  label: value,
  compactLabel:
    value === 'Engineering Manager'
      ? 'Eng. Manager'
      : value.replace(' Engineer', '').replace('Full-Stack', 'Full-stack'),
}));

export const SETTINGS_INPUT_CLASS_NAME =
  'h-9 w-full rounded-lg border border-white/10 bg-[#09090b] px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20';

export const SETTINGS_EXPERIENCE_OPTIONS = ONBOARDING_EXPERIENCE_OPTIONS;
export const SETTINGS_DIFFICULTY_OPTIONS = ONBOARDING_DIFFICULTY_OPTIONS;
