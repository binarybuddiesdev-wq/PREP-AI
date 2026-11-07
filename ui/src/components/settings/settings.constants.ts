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
  { id: 'plan', label: 'Plan' },
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
  'h-[42px] w-full rounded-lg border border-[var(--border2)] bg-[var(--bg2)] px-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--faint)] focus:border-[var(--accent-border)] focus:ring-2 focus:ring-[var(--accent-bg)]';

export const SETTINGS_EXPERIENCE_OPTIONS = ONBOARDING_EXPERIENCE_OPTIONS;
export const SETTINGS_DIFFICULTY_OPTIONS = ONBOARDING_DIFFICULTY_OPTIONS;
export const SETTINGS_TOPICS = ['React', 'TypeScript', 'System Design', 'DSA', 'NestJS', 'Node.js'];
export const SETTINGS_SESSION_LENGTH_OPTIONS = [5, 10, 15, 20].map((count) => ({
  value: String(count),
  label: `${count} questions`,
}));
export const SETTINGS_TIMER_OPTIONS = [
  { value: '0', label: 'No timer' },
  { value: '2', label: '2 minutes' },
  { value: '5', label: '5 minutes' },
  { value: '10', label: '10 minutes' },
];
