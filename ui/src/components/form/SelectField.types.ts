import type { ISelectOption } from '@/core';

export interface ISelectFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: readonly ISelectOption[];
  onChange: (value: string) => void;
}
