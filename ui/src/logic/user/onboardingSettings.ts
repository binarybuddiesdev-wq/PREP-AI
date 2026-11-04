import {
  DEFAULT_ONBOARDING_DRAFT,
  ONBOARDING_DIFFICULTY_OPTIONS,
  ONBOARDING_EXPERIENCE_OPTIONS,
  ONBOARDING_ROLE_OPTIONS,
  ONBOARDING_TOPICS,
  type IOnboardingDraft,
  type IOnboardingState,
  type IUpdateSettingsBody,
  type IUserSettings,
  type OnboardingStep,
} from '@/core';

const LEGACY_ROLE_VALUES: Record<string, IOnboardingDraft['targetRole']> = {
  Frontend: 'Frontend Engineer',
  FullStack: 'Full-Stack Engineer',
  Backend: 'Backend Engineer',
  DevOps: 'DevOps Engineer',
  EngManager: 'Engineering Manager',
};

const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === 'string' && values.includes(value as T);

const isOnboardingRole = (value: unknown): value is NonNullable<IOnboardingDraft['targetRole']> =>
  typeof value === 'string' && ONBOARDING_ROLE_OPTIONS.some((option) => option.value === value);

const isExperienceLevel = (
  value: unknown
): value is NonNullable<IOnboardingDraft['experienceLevel']> =>
  typeof value === 'string' &&
  ONBOARDING_EXPERIENCE_OPTIONS.some((option) => option.value === value);

const isOnboardingDifficulty = (value: unknown): value is IOnboardingDraft['defaultDifficulty'] =>
  typeof value === 'string' &&
  ONBOARDING_DIFFICULTY_OPTIONS.some((option) => option.value === value);

const getTargetRole = (value: unknown): IOnboardingDraft['targetRole'] => {
  if (isOnboardingRole(value)) return value;
  if (typeof value === 'string') return LEGACY_ROLE_VALUES[value] ?? '';
  return '';
};

const getExperienceLevel = (value: unknown): IOnboardingDraft['experienceLevel'] =>
  isExperienceLevel(value) ? value : '';

const getPreferredTopics = (value: unknown): IOnboardingDraft['preferredTopics'] => {
  if (!Array.isArray(value)) return [...DEFAULT_ONBOARDING_DRAFT.preferredTopics];

  const validTopics = value.filter((topic): topic is (typeof ONBOARDING_TOPICS)[number] =>
    isOneOf(topic, ONBOARDING_TOPICS)
  );

  return value.length > 0 && validTopics.length === 0
    ? [...DEFAULT_ONBOARDING_DRAFT.preferredTopics]
    : validTopics;
};

const getDefaultDifficulty = (value: unknown): IOnboardingDraft['defaultDifficulty'] => {
  return isOnboardingDifficulty(value) ? value : DEFAULT_ONBOARDING_DRAFT.defaultDifficulty;
};

const getOnboardingStep = (value: unknown): OnboardingStep =>
  value === 2 || value === 3 ? value : 1;

export const getOnboardingState = (
  settings: IUserSettings | null | undefined
): IOnboardingState => {
  const profile = settings?.profile;
  const preferences = settings?.preferences;

  return {
    draft: {
      targetRole: getTargetRole(profile?.targetRole),
      experienceLevel: getExperienceLevel(profile?.experienceLevel),
      targetCompanies: typeof profile?.targetCompanies === 'string' ? profile.targetCompanies : '',
      preferredTopics: getPreferredTopics(preferences?.preferredTopics),
      defaultDifficulty: getDefaultDifficulty(preferences?.defaultDifficulty),
    },
    step: getOnboardingStep(preferences?.onboardingStep),
  };
};

export const toOnboardingSettingsBody = (
  draft: IOnboardingDraft,
  settings: IUserSettings | null | undefined,
  nextStep: OnboardingStep
): IUpdateSettingsBody => ({
  profile: {
    ...settings?.profile,
    targetRole: draft.targetRole,
    experienceLevel: draft.experienceLevel,
    targetCompanies: draft.targetCompanies,
  },
  preferences: {
    ...settings?.preferences,
    preferredTopics: draft.preferredTopics,
    defaultDifficulty: draft.defaultDifficulty,
    onboardingStep: nextStep,
  },
});
