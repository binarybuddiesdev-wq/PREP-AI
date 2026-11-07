export type OnboardingStep = 1 | 2 | 3;

export type OnboardingRole =
  | 'Frontend Engineer'
  | 'Full-Stack Engineer'
  | 'Backend Engineer'
  | 'DevOps Engineer'
  | 'Engineering Manager';

export type OnboardingExperienceLevel = 'Junior' | 'Mid' | 'Senior';

export type OnboardingDifficulty = 'Junior' | 'Mid' | 'Senior';

export type OnboardingTopic =
  | 'React'
  | 'TypeScript'
  | 'HTML'
  | 'CSS'
  | 'DSA'
  | 'Node.js'
  | 'ExpressJS'
  | 'NestJS'
  | 'MongoDB'
  | 'System Design';

export interface IOnboardingDraft {
  targetRole: OnboardingRole | '';
  experienceLevel: OnboardingExperienceLevel | '';
  targetCompanies: string;
  preferredTopics: OnboardingTopic[];
  defaultDifficulty: OnboardingDifficulty;
}

export interface IOnboardingState {
  draft: IOnboardingDraft;
  step: OnboardingStep;
}
