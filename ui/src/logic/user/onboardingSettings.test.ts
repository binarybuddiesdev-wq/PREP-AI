import { describe, expect, it } from 'vitest';

import { DEFAULT_ONBOARDING_DRAFT, type IUserSettings } from '@/core';
import { getOnboardingState, toOnboardingSettingsBody } from './onboardingSettings';

const settings = (overrides: Partial<IUserSettings>): IUserSettings => ({
  id: 'settings-1',
  userId: 'user-1',
  profile: null,
  preferences: null,
  notifications: null,
  ...overrides,
});

describe('getOnboardingState', () => {
  it('starts with the reference defaults when settings are missing', () => {
    expect(getOnboardingState(null)).toEqual({
      draft: DEFAULT_ONBOARDING_DRAFT,
      step: 1,
    });
  });

  it('restores saved profile, preferences, and progress', () => {
    expect(
      getOnboardingState(
        settings({
          profile: {
            targetRole: 'Backend',
            experienceLevel: 'Senior',
            targetCompanies: 'Stripe, Shopify',
          },
          preferences: {
            preferredTopics: ['TypeScript', 'Node.js'],
            defaultDifficulty: 'Junior',
            onboardingStep: 3,
          },
        })
      )
    ).toEqual({
      draft: {
        targetRole: 'Backend Engineer',
        experienceLevel: 'Senior',
        targetCompanies: 'Stripe, Shopify',
        preferredTopics: ['TypeScript', 'Node.js'],
        defaultDifficulty: 'Junior',
      },
      step: 3,
    });
  });

  it('falls back safely when saved values are malformed or unsupported', () => {
    expect(
      getOnboardingState(
        settings({
          profile: {
            targetRole: 3 as unknown as string,
            experienceLevel: 'Expert',
            targetCompanies: null as unknown as string,
          },
          preferences: {
            preferredTopics: ['Unsupported', 4],
            defaultDifficulty: 'Mixed',
            onboardingStep: 8,
          },
        })
      )
    ).toEqual({ draft: DEFAULT_ONBOARDING_DRAFT, step: 1 });
  });
});

describe('toOnboardingSettingsBody', () => {
  it('merges onboarding values without deleting unrelated settings', () => {
    const existingSettings = settings({
      profile: { targetRole: 'Frontend', customProfileField: 'kept' },
      preferences: { theme: 'light', customPreference: true },
    });

    const draft = getOnboardingState(existingSettings).draft;

    expect(toOnboardingSettingsBody(draft, existingSettings, 2)).toEqual({
      profile: {
        targetRole: 'Frontend Engineer',
        experienceLevel: '',
        targetCompanies: '',
        customProfileField: 'kept',
      },
      preferences: {
        theme: 'light',
        customPreference: true,
        preferredTopics: ['React'],
        defaultDifficulty: 'Mid',
        onboardingStep: 2,
      },
    });
  });
});
