import type { ISelectOption } from '../user';

export const ONBOARDING_ROLE_OPTIONS: readonly ISelectOption[] = [
  { value: 'Frontend Engineer', label: 'Frontend Engineer' },
  { value: 'Full-Stack Engineer', label: 'Full-Stack Engineer' },
  { value: 'Backend Engineer', label: 'Backend Engineer' },
  { value: 'DevOps Engineer', label: 'DevOps Engineer' },
  { value: 'Engineering Manager', label: 'Engineering Manager' },
];

export const ONBOARDING_EXPERIENCE_OPTIONS: readonly ISelectOption[] = [
  { value: 'Junior', label: 'Junior (0-2 yrs)' },
  { value: 'Mid', label: 'Mid (2-5 yrs)' },
  { value: 'Senior', label: 'Senior (5+ yrs)' },
];

export const ONBOARDING_TOPICS = [
  'React',
  'TypeScript',
  'HTML',
  'CSS',
  'Node.js',
  'ExpressJS',
  'NestJS',
  'MongoDB',
  'System Design',
] as const;

export const ONBOARDING_DIFFICULTY_OPTIONS: readonly ISelectOption[] = [
  { value: 'Junior', label: 'Junior' },
  { value: 'Mid', label: 'Mid' },
  { value: 'Senior', label: 'Senior' },
];

export const DEFAULT_ONBOARDING_DRAFT = {
  targetRole: '',
  experienceLevel: '',
  targetCompanies: '',
  preferredTopics: ['React'],
  defaultDifficulty: 'Mid',
} as const;
