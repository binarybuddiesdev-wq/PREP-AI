import type { ISelectOption } from './user.types';

export const TARGET_ROLE_OPTIONS: readonly ISelectOption[] = [
  { value: 'Frontend', label: 'Frontend' },
  { value: 'FullStack', label: 'FullStack' },
  { value: 'Backend', label: 'Backend' },
  { value: 'DevOps', label: 'DevOps' },
  { value: 'EngManager', label: 'Eng Manager' },
];

export const EXPERIENCE_LEVEL_OPTIONS: readonly ISelectOption[] = [
  { value: 'Junior', label: 'Junior' },
  { value: 'Mid', label: 'Mid' },
  { value: 'Senior', label: 'Senior' },
];
